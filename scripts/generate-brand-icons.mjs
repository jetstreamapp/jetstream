#!/usr/bin/env node
/**
 * Generates every tile-style Jetstream icon (favicons, touch icons, extension icons) from one parametric SVG, so each
 * surface differs only by colour and never by shape.
 *
 *   pnpm icons:brand
 *
 * Output file names are public URLs (see libs/shared/assets/README.md) - change the colours here, never the names.
 * The desktop app icons (libs/shared/assets/public/images/desktop) are not generated: macOS needs its own padded
 * squircle and an .icns container.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SHARED_IMAGES_DIR = join(REPO_ROOT, 'libs/shared/assets/public/images');
const ADMIN_PUBLIC_DIR = join(REPO_ROOT, 'apps/admin/public');

/** Everything is drawn on a 64 unit grid. */
const GRID = 64;
const ROUNDED_RADIUS = 12;
const J_PATH =
  'M26,65.09C29.19,64.85 32,63.97 33.66,62.09C35.58,59.86 36.3,56.82 36.3,47.56L36.3,15.25L43.3,15.25L43.3,50.31C43.3,57.82 42.1,62.69 38.66,66.21C35.55,69.32 30.44,70.6 26.66,70.6L26,65.09ZM44.11,4.39C44.11,6.8 42.25,8.72 39.98,8.72C37.29,8.71 35.4,6.82 35.4,4.39C35.4,1.94 37.34,0 39.87,0C42.24,0 44.12,1.88 44.11,4.39Z';

const TEAL_GRADIENT = { from: '#0d9488', to: '#0e7490' };

/**
 * One entry per meaning, not per file. `tile` is a colour or a horizontal gradient, `outline` draws a hairline so a
 * white tile survives a white tab strip.
 */
const VARIANTS = {
  // Web app, landing page, browser extension, canvas app
  product: { tile: TEAL_GRADIENT, mark: '#ffffff', bars: '#e4e4e4' },
  // Web app served by a development server, so a localhost tab is never mistaken for production
  development: { tile: '#c2410c', mark: '#ffffff', bars: '#fed7aa' },
  staging: { tile: '#6d28d9', mark: '#ffffff', bars: '#ddd6fe' },
  docs: { tile: '#ffffff', mark: '#0e7490', bars: '#0d9488', outline: '#c9d6d5' },
  admin: { tile: '#b91c1c', mark: '#ffffff', bars: '#fecaca' },
};

/**
 * @param {keyof typeof VARIANTS} variantName
 * @param {{ size?: number, radius?: number }} [options] `size` sets pixel dimensions (omit for a scalable file)
 */
function buildSvg(variantName, { size, radius = ROUNDED_RADIUS } = {}) {
  const { tile, mark, bars, outline } = VARIANTS[variantName];
  const isGradient = typeof tile !== 'string';
  const inset = outline ? 1 : 0;
  const dimensions = size ? ` width="${size}" height="${size}"` : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}"${dimensions}>`,
    isGradient
      ? `  <defs><linearGradient id="tile" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${tile.from}"/><stop offset="1" stop-color="${tile.to}"/></linearGradient></defs>`
      : null,
    `  <rect x="${inset}" y="${inset}" width="${GRID - inset * 2}" height="${GRID - inset * 2}" rx="${radius}" fill="${isGradient ? 'url(#tile)' : tile}"${outline ? ` stroke="${outline}" stroke-width="2"` : ''}/>`,
    `  <g transform="translate(14.35 3.76) scale(0.8)">`,
    `    <rect y="47.15" width="34.64" height="7.5" fill="${bars}"/>`,
    `    <rect x="10.64" y="32.15" width="24" height="7.5" fill="${bars}"/>`,
    `    <rect x="17.64" y="15.65" width="17" height="7.5" fill="${bars}"/>`,
    `    <path fill="${mark}" d="${J_PATH}"/>`,
    `  </g>`,
    `</svg>`,
    '',
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function renderPng(variantName, size, options) {
  return sharp(Buffer.from(buildSvg(variantName, { ...options, size })))
    .png()
    .toBuffer();
}

/** Packs PNG images into an .ico container (PNG payloads are valid in .ico since Windows Vista). */
function buildIco(images) {
  const HEADER_SIZE = 6;
  const ENTRY_SIZE = 16;
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let dataOffset = HEADER_SIZE + ENTRY_SIZE * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(ENTRY_SIZE);
    entry.writeUInt8(size, 0); // width
    entry.writeUInt8(size, 1); // height
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(dataOffset, 12);
    dataOffset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function renderIco(variantName, sizes = [16, 32, 48]) {
  const images = await Promise.all(sizes.map(async (size) => ({ size, png: await renderPng(variantName, size) })));
  return buildIco(images);
}

function write(filePath, contents) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  console.log(`  ${filePath.replace(`${REPO_ROOT}/`, '')}`);
}

async function writePngs(variantName, files, options) {
  for (const [fileName, size] of Object.entries(files)) {
    write(join(SHARED_IMAGES_DIR, fileName), await renderPng(variantName, size, options));
  }
}

const FAVICON_SIZES = [16, 32, 96];
const sizedNames = (prefix, sizes, separator = 'x') =>
  Object.fromEntries(sizes.map((size) => [`${prefix}-${separator === 'x' ? `${size}x${size}` : size}.png`, size]));

console.log('Product (web app, landing, extension, canvas)');
write(join(SHARED_IMAGES_DIR, 'favicon.ico'), await renderIco('product'));
await writePngs('product', sizedNames('favicon', FAVICON_SIZES));
await writePngs('product', sizedNames('android-icon', [36, 48, 72, 96, 144, 192]));
await writePngs('product', sizedNames('jetstream-icon-pro', [16, 24, 32, 48, 128], '-'));
// iOS and Windows apply their own mask, so these are full-bleed squares
await writePngs(
  'product',
  {
    ...sizedNames('apple-icon', [57, 60, 72, 76, 114, 120, 144, 152, 180]),
    'apple-icon.png': 192,
    'apple-icon-precomposed.png': 192,
    ...sizedNames('ms-icon', [70, 144, 150, 310]),
  },
  { radius: 0 },
);

console.log('Development and staging');
await writePngs('development', sizedNames('favicon-development', FAVICON_SIZES));
await writePngs('staging', sizedNames('favicon-staging', FAVICON_SIZES));

console.log('Docs');
write(join(SHARED_IMAGES_DIR, 'favicon-docs.ico'), await renderIco('docs'));

console.log('Admin');
write(join(ADMIN_PUBLIC_DIR, 'favicon.svg'), buildSvg('admin'));
write(join(ADMIN_PUBLIC_DIR, 'favicon.ico'), await renderIco('admin'));
