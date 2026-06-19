import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: GitHub Pages base path.
// - Project page (https://<user>.github.io/<REPO>/): set base to '/<REPO>/'.
//   GitHub Pages serves the path with the EXACT repository-name casing, and the
//   CDN path is case-sensitive — this repo is "Slicer", so base must be '/Slicer/'.
// - User/Org page or custom domain (served from the domain root): set base to '/'.
// You can override at build time with:  BASE_PATH=/ npm run build
const base = process.env.BASE_PATH ?? '/Slicer/';

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
