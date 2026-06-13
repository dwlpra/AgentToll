import { config } from "../config.js";

// Default timeout for all fetch calls (15 seconds)
const FETCH_TIMEOUT_MS = 15_000;

interface AcceptEntry {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  payTo: string;
  asset: string;
  maxTimeoutSeconds: number;
}

interface CatalogItem {
  path: string;
  title: string;
  priceUSD: number;
  priceUnits: string;
  freshness: string;
  sources: number;
  verified: boolean;
  summary: string;
}

interface FetchResult {
  status: number;
  data?: any;
  accepts?: AcceptEntry[];
  error?: string;
  path: string;
}

/**
 * Fetch with timeout — prevents hanging if gateway is unresponsive.
 */
async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch the resource catalog from the gateway.
 * Returns an array of CatalogItem with metadata and pricing.
 */
export async function fetchCatalog(): Promise<CatalogItem[]> {
  try {
    const res = await fetchWithTimeout(`${config.gatewayUrl}/catalog`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`catalog fetch failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    const body = await res.json();
    if (!body.catalog || !Array.isArray(body.catalog)) {
      throw new Error("catalog response missing 'catalog' array");
    }
    return body.catalog;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`catalog fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s — is the gateway running?`);
    }
    throw err;
  }
}

/**
 * Fetch a single resource. Returns 402 with payment info if not yet paid,
 * or the resource data if authorized.
 */
export async function fetchResource(path: string): Promise<FetchResult> {
  try {
    const res = await fetchWithTimeout(`${config.gatewayUrl}${path}`, {
      headers: { "Content-Type": "application/json" },
    });

    if (res.status === 402) {
      const body = await res.json();
      return {
        status: 402,
        accepts: body.accepts,
        path,
      };
    }

    if (res.ok) {
      const data = await res.json();
      return { status: 200, data, path };
    }

    return {
      status: res.status,
      error: `HTTP ${res.status}`,
      path,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { status: 0, error: `fetch timed out for ${path}`, path };
    }
    return { status: 0, error: `fetch error: ${err instanceof Error ? err.message : err}`, path };
  }
}

/**
 * Fetch a resource after payment, using X-AUTHORIZED-WALLET header.
 */
export async function fetchWithPayment(
  path: string,
  wallet: string
): Promise<FetchResult> {
  try {
    const res = await fetchWithTimeout(`${config.gatewayUrl}${path}`, {
      headers: {
        "X-AUTHORIZED-WALLET": wallet,
      },
    });

    if (res.ok) {
      const data = await res.json();
      return { status: 200, data, path };
    }

    return {
      status: res.status,
      error: `HTTP ${res.status}`,
      path,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { status: 0, error: `fetch timed out for ${path} after payment`, path };
    }
    return { status: 0, error: `fetch error: ${err instanceof Error ? err.message : err}`, path };
  }
}
