#!/usr/bin/env node
/**
 * Runs the TypeScript language service's "Organize Imports" code action
 * on a set of files — the same code action VSCode invokes on save with
 * `"source.organizeImports": "explicit"`.
 *
 * This is the TypeScript-server-driven organize, NOT an ESLint rule. It
 * sorts/combines imports and removes unused ones, honoring the project's
 * tsconfig path mappings and the `importModuleSpecifier` preference.
 *
 * Usage:
 *   node scripts/organize-imports.mjs <file-or-glob> [<file-or-glob> ...]
 *   node scripts/organize-imports.mjs --check <file-or-glob> ...
 *
 * Examples:
 *   node scripts/organize-imports.mjs apps/jetstream/src/main.tsx
 *   node scripts/organize-imports.mjs "apps/jetstream/src/**\/*.tsx"
 *   node scripts/organize-imports.mjs --check libs/ui/src
 */
import minimist from 'minimist';
import path from 'path';
import { fileURLToPath } from 'url';
import { chalk, fs, glob } from 'zx';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'check', 'quiet'],
  alias: { h: 'help', q: 'quiet' },
});

if (argv.help || argv._.length === 0) {
  printHelp();
  process.exit(argv.help ? 0 : 1);
}

const TS_EXT = /\.(ts|tsx|mts|cts)$/;

const resolvedFiles = await resolveInputs(argv._.map(String));
if (resolvedFiles.length === 0) {
  console.log(chalk.yellow('No matching TypeScript files found.'));
  process.exit(0);
}

const groupedByTsconfig = groupBy(resolvedFiles, findNearestTsConfig);

let changedCount = 0;
let processedCount = 0;

for (const [tsconfigPath, filesForConfig] of groupedByTsconfig) {
  const service = createLanguageService(tsconfigPath, filesForConfig);
  if (!service) {
    continue;
  }
  for (const filePath of filesForConfig) {
    processedCount++;
    const result = organizeFile(service, filePath);
    if (result === 'unchanged') {
      if (!argv.quiet) {
        console.log(chalk.gray(`  ${path.relative(REPO_ROOT, filePath)} - no changes`));
      }
      continue;
    }
    changedCount++;
    if (argv.check) {
      console.log(chalk.yellow(`  ${path.relative(REPO_ROOT, filePath)} - would change`));
    } else {
      fs.writeFileSync(filePath, result, 'utf8');
      console.log(chalk.green(`  ${path.relative(REPO_ROOT, filePath)} - organized`));
    }
  }
}

if (argv.check) {
  if (changedCount > 0) {
    console.log(chalk.red(`\n${changedCount} of ${processedCount} file(s) need organize-imports.`));
    process.exit(1);
  }
  console.log(chalk.green(`\n${processedCount} file(s) already organized.`));
  process.exit(0);
}

console.log(chalk.blue(`\n${changedCount} of ${processedCount} file(s) updated.`));

function printHelp() {
  console.log(`
Usage: node scripts/organize-imports.mjs [options] <files-or-globs...>

Runs the TypeScript language service's "Organize Imports" action on the
given files — the same one VSCode runs on save (NOT an ESLint rule).

Arguments:
  <files-or-globs>  One or more file paths, directories, or globs.
                    Directories are expanded to all .ts/.tsx files inside.

Options:
  -h, --help     Show this help and exit
      --check    Do not write changes; exit 1 if any file needs organize
  -q, --quiet    Suppress per-file "no changes" output

Examples:
  node scripts/organize-imports.mjs apps/jetstream/src/main.tsx
  node scripts/organize-imports.mjs "apps/jetstream/src/**/*.tsx"
  node scripts/organize-imports.mjs --check libs/ui/src
`);
}

async function resolveInputs(inputs) {
  const collected = new Set();
  for (const input of inputs) {
    const absolute = path.isAbsolute(input) ? input : path.resolve(REPO_ROOT, input);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isDirectory()) {
      const directoryMatches = await glob(['**/*.{ts,tsx,mts,cts}'], {
        cwd: absolute,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**'],
      });
      directoryMatches.forEach((match) => collected.add(match));
      continue;
    }
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) {
      collected.add(absolute);
      continue;
    }
    const globMatches = await glob([input], {
      cwd: REPO_ROOT,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**'],
    });
    globMatches.forEach((match) => collected.add(match));
  }
  return Array.from(collected).filter((filePath) => TS_EXT.test(filePath));
}

function findNearestTsConfig(filePath) {
  let directory = path.dirname(filePath);
  while (directory.startsWith(REPO_ROOT)) {
    const candidate = path.join(directory, 'tsconfig.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      break;
    }
    directory = parent;
  }
  return path.join(REPO_ROOT, 'tsconfig.base.json');
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return map;
}

function createLanguageService(tsconfigPath, targetFiles) {
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    const message = ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n');
    console.error(chalk.red(`Error reading ${tsconfigPath}: ${message}`));
    return null;
  }
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, path.dirname(tsconfigPath));

  const knownFiles = new Set(parsed.fileNames.map((file) => path.resolve(file)));
  targetFiles.forEach((file) => knownFiles.add(path.resolve(file)));

  const snapshotCache = new Map();
  const versions = new Map();

  const host = {
    getScriptFileNames: () => Array.from(knownFiles),
    getScriptVersion: (fileName) => String(versions.get(fileName) ?? 0),
    getScriptSnapshot: (fileName) => {
      if (snapshotCache.has(fileName)) {
        return snapshotCache.get(fileName);
      }
      if (!ts.sys.fileExists(fileName)) {
        return undefined;
      }
      const text = ts.sys.readFile(fileName);
      if (text === undefined) {
        return undefined;
      }
      const snapshot = ts.ScriptSnapshot.fromString(text);
      snapshotCache.set(fileName, snapshot);
      return snapshot;
    },
    getCurrentDirectory: () => path.dirname(tsconfigPath),
    getCompilationSettings: () => parsed.options,
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories,
    useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
  };

  return ts.createLanguageService(host, ts.createDocumentRegistry());
}

function organizeFile(service, filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const newLineCharacter = original.includes('\r\n') ? '\r\n' : '\n';

  const formatOptions = {
    ...ts.getDefaultFormatCodeSettings(newLineCharacter),
    convertTabsToSpaces: true,
    indentSize: 2,
    tabSize: 2,
  };

  // Mirrors VSCode's `source.organizeImports`: mode 'All' sorts/combines
  // and removes unused imports. `importModuleSpecifier: 'project-relative'`
  // matches `.vscode/settings.json`.
  const preferences = {
    quotePreference: 'single',
    importModuleSpecifierPreference: 'project-relative',
    importModuleSpecifierEnding: 'minimal',
  };

  const textChanges = service.organizeImports(
    { type: 'file', fileName: filePath, mode: ts.OrganizeImportsMode.All },
    formatOptions,
    preferences,
  );

  const fileChanges = textChanges.find((change) => path.resolve(change.fileName) === path.resolve(filePath));
  if (!fileChanges || fileChanges.textChanges.length === 0) {
    return 'unchanged';
  }

  const updated = applyTextChanges(original, fileChanges.textChanges);
  if (updated === original) {
    return 'unchanged';
  }
  return updated;
}

function applyTextChanges(text, changes) {
  const sorted = [...changes].sort((left, right) => right.span.start - left.span.start);
  let result = text;
  for (const change of sorted) {
    const start = change.span.start;
    const end = change.span.start + change.span.length;
    result = result.slice(0, start) + change.newText + result.slice(end);
  }
  return result;
}
