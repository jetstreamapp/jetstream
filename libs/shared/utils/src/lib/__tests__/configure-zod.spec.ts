import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { countEvalConstructions, hasProbedForEval } from './zod-eval-probe.utils';

const REPO_ROOT = join(import.meta.dirname, '../../../../../..');

/**
 * Every browser entry point, all of which must import configure-zod before anything else. Zod's eval
 * probe runs while an entry point's *imports* are evaluated — long before its own first statement —
 * so import position is the entire contract.
 */
const BROWSER_ENTRY_POINTS = [
  'apps/jetstream/src/main.tsx',
  'apps/jetstream-desktop-client/src/main.tsx',
  'apps/jetstream-canvas/src/main.tsx',
  'apps/landing/pages/_app.js',
  'apps/jetstream-web-extension/src/pages/app/App.tsx',
  'apps/jetstream-web-extension/src/pages/popup/Popup.tsx',
  'apps/jetstream-web-extension/src/pages/additional-settings/AdditionalSettings.tsx',
];

/**
 * The other half of the contract. In a Vite build, being first in the entry file is not enough: unless
 * configure-zod gets its own chunk it is merged into the entry chunk, which runs after every chunk the
 * entry imports — schemas included. Verified against the production builds under a strict CSP.
 */
const VITE_APP_CONFIGS = [
  'apps/jetstream/vite.config.mts',
  'apps/jetstream-desktop-client/vite.config.mts',
  'apps/jetstream-canvas/vite.config.mts',
  'apps/jetstream-web-extension/vite.config.mts',
];

describe('configure-zod', () => {
  it('should keep Zod from probing for eval support when schemas are built and parsed', async () => {
    // Imported here rather than at the top of the file so the ordering the test depends on — configured
    // before the first schema is constructed — is explicit and survives organize-imports.
    await import('../configure-zod');

    const evalConstructions = countEvalConstructions(() => {
      const schema = z.object({ name: z.string() });
      schema.parse({ name: 'Jetstream' });
    });

    // Zero, not "one that fails" — under a strict CSP a caught failure is still a reported violation.
    expect(evalConstructions).toBe(0);
    expect(hasProbedForEval()).toBe(false);
    expect(z.config().jitless).toBe(true);
  });

  it.each(BROWSER_ENTRY_POINTS)('should be the first import in %s', (entryPoint) => {
    const firstImport = readFileSync(join(REPO_ROOT, entryPoint), 'utf8')
      .split('\n')
      .find((line) => line.startsWith('import'));

    expect(firstImport).toBe(`import '@jetstream/shared/utils/configure-zod';`);
  });

  it.each(VITE_APP_CONFIGS)('should be given its own chunk by %s', (viteConfig) => {
    expect(readFileSync(join(REPO_ROOT, viteConfig), 'utf8')).toContain(
      `advancedChunks: { groups: [{ name: 'configure-zod', test: /configure-zod/, priority: 100 }] }`,
    );
  });
});
