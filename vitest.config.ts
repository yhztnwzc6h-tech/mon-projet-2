import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'pipeline/test/**/*.test.ts', 'src/**/*.test.{ts,tsx}'],
  },
});
