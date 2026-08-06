import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NEXTAUTH_SECRET: 'test-secret-for-vitest-12345678901234567890',
    },
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/zcc-security.ts', 'src/lib/message-bundler.ts'],
    },
    testTimeout: 15000,
    hookTimeout: 10000,
    // Prevent Vite from trying to resolve CSS / PostCSS for tests.
    server: {
      deps: {
        inline: [/@\/.*/],
      },
    },
    // Skip PostCSS processing during tests.
    deps: {
      optimizer: {
        web: {
          exclude: ['postcss', '@tailwindcss/postcss'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
});
