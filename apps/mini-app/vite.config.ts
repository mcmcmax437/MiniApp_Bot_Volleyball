import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        // Matches the API port in .env (PORT=4017). Vite reads .env via the
        // root env_dir, but loading it here would create a chicken-and-egg
        // with the mini-app's own .env parsing — keep it explicit.
        target: 'http://localhost:4017',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});