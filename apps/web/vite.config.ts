import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// MIDAD_BASE lets CI publish under a sub-path (e.g. GitHub Pages: /midad/).
export default defineConfig({
  base: process.env.MIDAD_BASE ?? '/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
