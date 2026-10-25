import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const api = process.env.MCH_API_URL ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the backend runs separately; same-origin in production.
    proxy: { '/api': { target: api, changeOrigin: true, ws: true } },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Never inline assets as data: URLs. The server's content security policy only
    // allows fonts and scripts from the site itself, so an inlined font would be blocked.
    assetsInlineLimit: 0,
  },
});
