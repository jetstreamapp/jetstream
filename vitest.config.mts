import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      TZ: 'UTC',
    },
    passWithNoTests: true,
    projects: ['apps/*/{vitest,vite}.config.{ts,mts}', 'libs/**/{vitest,vite}.config.{ts,mts}'],
  },
});
