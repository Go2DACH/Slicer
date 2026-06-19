import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: GitHub Pages base path.
// - Project page (https://<user>.github.io/<REPO>/): set base to '/<REPO>/'.
//   This repo is "slicer", so the default below is '/slicer/'.
// - User/Org page or custom domain (served from the domain root): set base to '/'.
// You can override at build time with:  BASE_PATH=/ npm run build
const base = process.env.BASE_PATH ?? '/slicer/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  worker: {
    format: 'es',
  },
});
