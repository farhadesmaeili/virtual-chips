import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Don't fail the suite when a package has no tests yet (early phases),
    // but a genuinely failing test still turns the suite red.
    passWithNoTests: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
