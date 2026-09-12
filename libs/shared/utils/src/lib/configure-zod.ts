import { z } from 'zod';

/**
 * Side-effect module — importing it disables Zod's JIT compilation in the browser.
 *
 * Zod probes for `new Function` support to decide whether it can JIT-compile validators. Under our
 * browser CSP (`script-src` has no `'unsafe-eval'`) that probe always fails, and Zod swallows the
 * throw — but the browser still reports a `script-src eval` violation for every page load. That was
 * ~3k reports a day to `/api/csp-report`, drowning out any real violation.
 *
 * Setting `jitless` short-circuits the probe before it runs. There is no runtime cost in the browser:
 * the CSP had already forced Zod onto the interpreted path, so this only stops the reporting noise.
 *
 * WHY THIS IS A SIDE-EFFECT MODULE, AND WHY IT NEEDS BUILD CONFIG
 *
 * Zod runs the probe (and memoizes the result) the first time a schema is **constructed** — the
 * `z.object({...})` that runs at module scope in `@jetstream/types` and friends — not the first time
 * one is parsed. Winning that race takes two things, and both are load-bearing:
 *
 *  1. This module must be the FIRST import of the entry point. ES modules evaluate every import
 *     before the importing module's own body, so a function called from an entry point's body always
 *     loses.
 *  2. Every Vite app must keep the `configure-zod` chunk group in its build config. Position in the
 *     entry file is not enough on its own: merged into the entry chunk, this code runs after every
 *     chunk the entry imports — including the one holding the schemas. Its own chunk is what makes
 *     the entry import (and run) it first. This was verified by loading the production builds under a
 *     production-like CSP; without the group, the violation is still reported.
 *
 * Next.js (landing) needs only the import — webpack's chunking already preserves the order there.
 * configure-zod.spec.ts pins both requirements.
 *
 * No-ops outside the browser so the server (and Next.js static generation) keeps the JIT path, where
 * it works and is worth having.
 */
if (typeof window !== 'undefined') {
  z.config({ jitless: true });
}
