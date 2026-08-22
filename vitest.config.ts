import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NEXTAUTH_SECRET: 'test-secret-for-vitest-12345678901234567890',
    },
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/__tests__/**/*.test.ts',
      'src/__tests__/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      // Expand coverage to all src/lib modules. Previously only 2 files were
      // tracked (zcc-security.ts and message-bundler.ts), which made the
      // "94% test coverage" claim unmeasurable. With this expansion, the
      // vitest --coverage command produces a real per-file number.
      include: [
        'src/lib/zcc-security.ts',
        'src/lib/message-bundler.ts',
        'src/lib/security/**/*.ts',
        'src/lib/rate-limit.ts',
        'src/lib/payments/**/*.ts',
        'src/lib/locks/**/*.ts',
        'src/lib/lgpd/**/*.ts',
        'src/lib/queue/**/*.ts',
        'src/lib/ai/llm-timeout.ts',
        'src/lib/finance/**/*.ts',
        'src/lib/credits/**/*.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/__tests__/**',
        'node_modules/**',
      ],
      // Soft thresholds — start conservative and tighten over time.
      // Current real numbers (measured Aug 22 2026):
      //   - zcc-security.ts: ~95%
      //   - rate-limit.ts: ~70%
      //   - payments/pricing.ts: ~85%
      //   - lgpd/lgpd-service.ts: ~50% (newly persisted)
      //   - locks/orchestrator.ts: ~40% (only smoke-tested)
      // Goal: raise each to 80%+ over the next 2 sprints.
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 45,
        lines: 50,
      },
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
