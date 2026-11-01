import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec,e2e-spec}.ts'],
    fileParallelism: false,
    testTimeout: 90000,
    hookTimeout: 120000,
  },
});
