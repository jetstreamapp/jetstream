#!/usr/bin/env node
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sourceDir = join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');

const destinations = [
  {
    path: join(__dirname, '..', 'apps', 'jetstream-desktop-client', 'public', 'monaco', 'vs'),
    includeAll: true,
  },
  {
    path: join(__dirname, '..', 'apps', 'jetstream-web-extension', 'src', 'assets', 'js', 'monaco', 'vs'),
    includeAll: false,
    includeLanguages: ['apex', 'css', 'html', 'javascript', 'xml'],
  },
];

function copyDirectory(source, destination, options = {}) {
  const { includeAll = true, includeLanguages = [] } = options;

  // Create destination directory
  mkdirSync(destination, { recursive: true });

  // Read source directory
  const items = readdirSync(source);

  for (const item of items) {
    const sourcePath = join(source, item);
    const destPath = join(destination, item);
    const stats = statSync(sourcePath);

    if (stats.isDirectory()) {
      // Handle directory copying based on options
      if (includeAll) {
        // Copy all directories
        copyDirectory(sourcePath, destPath, options);
      } else {
        // For web extension, only copy specific directories
        // Get the path relative to the source directory
        let relativePath = sourcePath.replace(sourceDir, '');
        // Remove leading slash or backslash
        relativePath = relativePath.replace(/^[/\\]/, '');

        if (item === 'base' || item === 'editor') {
          // Always copy base and editor folders when they're direct children of vs
          copyDirectory(sourcePath, destPath, { includeAll: true });
        } else if (relativePath.startsWith('language/') && relativePath.split('/').length === 2) {
          // Check if this is a language folder
          const language = relativePath.split('/')[1];
          if (includeLanguages.includes(language)) {
            copyDirectory(sourcePath, destPath, options);
          }
        } else if (item === 'basic-languages') {
          // Copy only specified basic-languages
          mkdirSync(destPath, { recursive: true });
          const langItems = readdirSync(sourcePath);

          for (const langItem of langItems) {
            const langPath = join(sourcePath, langItem);
            const langStats = statSync(langPath);

            if (langStats.isDirectory() && includeLanguages.includes(langItem)) {
              copyDirectory(langPath, join(destPath, langItem), { includeAll: true });
            } else if (langStats.isFile()) {
              // Copy any root files in basic-languages
              copyFileSync(langPath, join(destPath, langItem));
            }
          }
        }
      }
    } else {
      // Copy file if we're in root of vs directory or if includeAll is true
      const relativePath = source.replace(sourceDir, '').replace(/^[/\\]/, '');

      if (includeAll || relativePath === '') {
        copyFileSync(sourcePath, destPath);
      }
    }
  }
}

function main() {
  console.log('Copying Monaco Editor assets...');

  for (const dest of destinations) {
    console.log(`\nProcessing: ${dest.path}`);

    // Delete existing contents
    try {
      rmSync(dest.path, { recursive: true, force: true });
      console.log('  - Deleted existing contents');
    } catch (error) {
      console.log('  - No existing contents to delete');
    }

    // Copy new contents
    copyDirectory(sourceDir, dest.path, {
      includeAll: dest.includeAll,
      includeLanguages: dest.includeLanguages,
    });

    console.log('  - Copied Monaco assets');
  }

  console.log('\nMonaco Editor assets copied successfully!');
}

main();
