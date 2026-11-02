import { z } from 'zod';

// Imported before anything else: zod checks whether it may compile parsers with `new Function` the first time a schema
// is created, and under our CSP that check files an eval violation report on every page load. The CSP blocks eval
// anyway, so this changes nothing but skipping the check.
z.config({ jitless: true });
