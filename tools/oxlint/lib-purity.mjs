import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/**
 * Libraries opt into tree-shaking by declaring `"sideEffects"` in their package.json, listing only
 * stylesheets. That promises bundlers nothing happens merely by importing a module, which is what
 * lets an unused barrel re-export be dropped instead of dragging its dependencies into every
 * consumer — importing one component from `@jetstream/ui` otherwise retains all ~236 of them.
 *
 * This rule keeps the promise honest, and applies only to libraries that made it: a lib with no
 * package.json is free to have import-time side effects. Assignments are allowed because they can
 * only reach bindings the module already owns (`Component.displayName = ...`), so a bundler that
 * drops the module drops the assignment with it.
 *
 * Limitation: only statements are checked, so a side effect hidden in an initializer
 * (`const db = new Dexie(...)`) still slips through. It is a guardrail, not a proof.
 */
const SIDE_EFFECTING_EXPRESSIONS = new Set(['CallExpression', 'NewExpression', 'AwaitExpression', 'TaggedTemplateExpression']);
const TEST_FILE = /(__tests__|\.spec\.|\.test\.)/;

const declaresSideEffectsCache = new Map();

function declaresNoSideEffects(filename) {
  let directory = dirname(filename);
  const { root } = parse(directory);

  while (directory !== root) {
    const cached = declaresSideEffectsCache.get(directory);
    if (cached !== undefined) {
      return cached;
    }

    const packageJsonPath = join(directory, 'package.json');
    if (existsSync(packageJsonPath)) {
      let declared = false;
      try {
        declared = JSON.parse(readFileSync(packageJsonPath, 'utf8')).sideEffects !== undefined;
      } catch {
        declared = false;
      }
      declaresSideEffectsCache.set(directory, declared);
      return declared;
    }

    directory = dirname(directory);
  }

  return false;
}

const noTopLevelSideEffects = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow calls that execute when a module of a side-effect-free library is imported' },
  },
  create(context) {
    // oxlint 1.77 does not apply JS-plugin rules from `overrides`, so scope is decided here.
    const filename = context.filename ?? context.physicalFilename ?? '';
    if (TEST_FILE.test(filename) || !declaresNoSideEffects(filename)) {
      return {};
    }

    return {
      Program(program) {
        for (const statement of program.body) {
          if (statement.type !== 'ExpressionStatement' || !SIDE_EFFECTING_EXPRESSIONS.has(statement.expression?.type)) {
            continue;
          }
          context.report({
            node: statement,
            message:
              'This runs when the module is imported, but the library declares itself side-effect free so a bundler may drop it. Move it into a function the consumer calls, or fold it into the declaration it mutates.',
          });
        }
      },
    };
  },
};

export default {
  meta: { name: 'lib-purity' },
  rules: { 'no-top-level-side-effects': noTopLevelSideEffects },
};
