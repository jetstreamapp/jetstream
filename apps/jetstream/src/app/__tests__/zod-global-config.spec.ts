import { describe, expect, it } from 'vitest';

declare global {
  // eslint-disable-next-line no-var
  var __zod_globalConfig: { jitless?: boolean } | undefined;
}

describe('zod global config', () => {
  // index.html sets this global before any bundle runs, so a zod upgrade that stops reading it would bring back the
  // CSP eval violation reports on every page load
  it('picks up jitless from the global config set before zod loads', async () => {
    globalThis.__zod_globalConfig = { jitless: true };
    const { z } = await import('zod');
    expect(z.config().jitless).toBe(true);
  });
});
