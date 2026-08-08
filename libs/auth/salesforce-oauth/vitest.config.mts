import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/libs/auth/salesforce-oauth',
  plugins: [nxCopyAssetsPlugin(['*.md'])],
  resolve: { tsconfigPaths: true },
  test: {
    name: 'salesforce-oauth',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/libs/auth/salesforce-oauth',
      provider: 'v8' as const,
    },
  },
}));
