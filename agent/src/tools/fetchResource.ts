import { config } from "../config.js";

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

export async function fetchCatalog(): Promise<CatalogItem[]> {
  const res = await fetch(`${config.gatewayUrl}/catalog`);
  if (!res.ok) throw new Error(`catalog fetch failed: ${res.status}`);
  const body = await res.json();
  return body.catalog;
}

export async function fetchResource(path: string): Promise<FetchResult> {
  const res = await fetch(`${config.gatewayUrl}${path}`, {
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
}

export async function fetchWithPayment(
  path: string,
  wallet: string
): Promise<FetchResult> {
  const res = await fetch(`${config.gatewayUrl}${path}`, {
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
}
