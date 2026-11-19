/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { contentSecurityPolicy } from './vite-plugins/csp';

// `base: './'` keeps asset URLs relative, so the build works under any
// GitHub Pages sub-path (https://<user>.github.io/<repo>/) without configuration.
export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  server: {
    // The emulators' saves: watching them only reloads the page and, on
    // Windows, holds the files so the save cannot finish.
    watch: { ignored: ['**/.emulator-data/**', '**/firebase-export-*/**', '**/*-debug.log'] },
  },
  build: {
    // The Firebase SDK (auth + Firestore) is its own chunk, ~580 kB before
    // compression (~175 kB gzipped). Anything larger is worth a look.
    chunkSizeWarningLimit: 600,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    restoreMocks: true,
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'], environment: 'node' },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          include: ['src/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
  },
});
