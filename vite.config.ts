import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `base: './'` keeps asset URLs relative, so the build works under any
// GitHub Pages sub-path (https://<user>.github.io/<repo>/) without configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
