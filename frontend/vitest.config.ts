import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      'bi-modules': fileURLToPath(new URL('./src/test-bi-modules.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [
      ...configDefaults.exclude,
      'out-tsc/**',
      'src/app/app.real-grid.spec.ts',
    ],
    setupFiles: ['src/test-setup.ts'],
    server: {
      deps: {
        inline: ['@salesbuzz/public-sdk'],
      },
    },
  },
});
