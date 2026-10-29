import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { countEvalConstructions, hasProbedForEval } from './zod-eval-probe.utils';

/**
 * Companion to configure-zod.spec.ts, deliberately kept in its own file: Zod memoizes its eval probe
 * the first time it is needed, so a process only ever gets one chance to observe it. These cases need
 * a Zod that has not been configured yet, which the other file has already used up.
 *
 * Together the two files pin the assumption the whole approach rests on — that the probe fires when a
 * schema is *constructed*, not when one is parsed — so a Zod upgrade that moves it fails loudly here
 * instead of silently restoring thousands of daily CSP reports.
 */
describe('Zod eval probe timing', () => {
  it('should probe when a schema is constructed, without anything being parsed', () => {
    expect(hasProbedForEval()).toBe(false);

    const evalConstructions = countEvalConstructions(() => {
      z.object({ name: z.string() });
    });

    expect(evalConstructions).toBe(1);
    expect(hasProbedForEval()).toBe(true);
  });

  it('should not be undone by configuring Zod after a schema has been constructed', async () => {
    // Ordering mirrors an entry point that calls into configure-zod from its own body: every module it
    // imported — @jetstream/types included — has already built its schemas by then.
    await import('../configure-zod');

    // The result is memoized, so the `new Function` call (and the CSP violation it reports) has already
    // happened. Late configuration silences nothing, which is why this is a first-position import.
    expect(hasProbedForEval()).toBe(true);
  });

  it('should leave the JIT path alone outside the browser', async () => {
    z.config({ jitless: false });
    vi.stubGlobal('window', undefined);
    vi.resetModules();

    await import('../configure-zod');

    expect(z.config().jitless).toBe(false);
    vi.unstubAllGlobals();
  });
});
