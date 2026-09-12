import { util } from 'zod/v4/core';

/**
 * Zod decides whether it can JIT-compile validators by running `new Function('')` once and memoizing
 * the answer. In the browser that single call is what a strict CSP reports as a `script-src eval`
 * violation, so these helpers observe exactly that call rather than any Zod-internal flag.
 */

/** Counts `new Function(...)` calls made while `runSchemaWork` executes. */
export function countEvalConstructions(runSchemaWork: () => void): number {
  const OriginalFunction = globalThis.Function;
  let evalConstructions = 0;
  globalThis.Function = new Proxy(OriginalFunction, {
    construct: (target, argumentList, newTarget) => {
      evalConstructions++;
      return Reflect.construct(target, argumentList, newTarget);
    },
  });
  try {
    runSchemaWork();
  } finally {
    globalThis.Function = OriginalFunction;
  }
  return evalConstructions;
}

/**
 * Zod memoizes the probe by replacing its lazy getter with a plain value, so the getter still being
 * in place proves the probe never ran.
 */
export function hasProbedForEval(): boolean {
  return Object.getOwnPropertyDescriptor(util.allowsEval, 'value')?.get === undefined;
}
