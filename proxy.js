/**
 * proxy.js — Reverse proxy for paytocrawl.xyz
 * 
 * Serves:
 *   /        → React UI (static dist)
 *   /api/*   → Gateway :19090
 *   /catalog → Gateway :19090
 *   /reports → Gateway :19090 (x402 resources)
 *   /webhook → Gateway :19090
 *   /health  → Gateway :19090
 * 
 * Listens on port 2053 (Cloudflare HTTPS proxy supported port)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 2053;
const GATEWAY = 'http://localhost:19090';
const UI_DIST = path.join(__dirname, 'ui', 'dist');

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
};

function proxyToGateway(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const target = `${GATEWAY}${url.pathname}${url.search}`;
  
  const headers = { ...req.headers, host: 'localhost:19090' };
  delete headers['cf-connecting-ip'];
  delete headers['cf-ipcountry'];
  delete headers['cf-ray'];
  delete headers['cf-visitor'];

  const proxyReq = http.request(target, {
    method: req.method,
    headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: 'gateway unavailable', detail: err.message }));
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  let filePath = path.join(UI_DIST, req.url === '/' ? 'index.html' : req.url);
  
  // SPA fallback: if file doesn't exist, serve index.html
  if (!fs.existsSync(filePath)) {
    filePath = path.join(UI_DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-PAYMENT, X-AUTHORIZED-WALLET, X-Browser-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route to gateway or static
  if (req.url.startsWith('/api/') || 
      req.url.startsWith('/catalog') || 
      req.url.startsWith('/reports/') ||
      req.url.startsWith('/webhook') ||
      req.url.startsWith('/health') ||
      req.url.startsWith('/dashboard')) {
    proxyToGateway(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`PayCrawl proxy listening on :${PORT}`);
  console.log(`  UI:     served from ui/dist`);
  console.log(`  API:    proxied to ${GATEWAY}`);
});
