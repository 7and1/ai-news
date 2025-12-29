import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/types/**',
        'src/middleware.ts',
        '**/*.config.{ts,js}',
        'e2e/**',
        'test-utils/**',
      ],
      all: true,
    },
    // Setup files
    setupFiles: ['./src/lib/test-utils/setup.ts'],
    // Test match patterns
    include: ['src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    // Exclude patterns
    exclude: ['node_modules/', 'dist/', 'build/', '.next/', 'e2e/'],
    // Timeout
    testTimeout: 10000,
    hookTimeout: 10000,
    // Restore and reset mocks between tests
    restoreMocks: true,
    clearMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
});
