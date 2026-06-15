import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Browser token is read SERVER-SIDE only (never exposed to browser JS).
// It proves to the Gateway that the request comes from the Vite proxy
// (i.e., a human using the React UI), not from an agent/crawler.
//
// Agent cannot see this token because:
// 1. It's read from process.env by the Vite server, not the browser
// 2. The browser JS never has access to it
// 3. DevTools only shows the browser's own headers, not the proxy's
const browserToken = process.env.GATEWAY_SECRET || 'gateway-secret-key-change-me'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    allowedHosts: ['paytocrawl.xyz', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:19090',
        changeOrigin: true,
      },
      '/catalog': {
        target: 'http://localhost:19090',
        changeOrigin: true,
      },
      '/webhook': {
        target: 'http://localhost:19090',
        changeOrigin: true,
      },
      '/reports': {
        target: 'http://localhost:19090',
        changeOrigin: true,
        // Inject browser token SERVER-SIDE on proxied requests.
        // The browser JS only calls fetch('/reports/...') — it never sees the token.
        // An agent checking DevTools sees only: GET /reports/asia-daily (no secret).
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('X-Browser-Token', browserToken)
          })
        },
      },
      '/health': {
        target: 'http://localhost:19090',
        changeOrigin: true,
      },
    },
  },
})
