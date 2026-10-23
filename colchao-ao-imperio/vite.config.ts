import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // /api vai para o servidor do Escritório (npm run office) durante o desenvolvimento
  server: { port: 5173, host: true, proxy: { '/api': { target: 'http://127.0.0.1:4317', changeOrigin: true } } },
  test: { environment: 'node' },
} as any);
