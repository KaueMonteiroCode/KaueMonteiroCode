import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Build só do Escritório (vira um arquivo único em office-server/public/escritorio.html)
export default defineConfig({
  plugins: [react()],
  base: './',
  publicDir: false,
  build: { outDir: 'dist-office', emptyOutDir: true, rollupOptions: { input: resolve(__dirname, 'escritorio.html') } },
});
