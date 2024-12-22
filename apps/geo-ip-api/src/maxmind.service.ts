import { logger } from '@jetstream/api-config';
import fs from 'fs';
import maxMind, { CityResponse, Reader } from 'maxmind';
import path from 'path';
import * as tar from 'tar';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);

// const ASN_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz';
// const ASN_FILENAME = 'GeoLite2-ASN.tar.gz';

const FOLDER_NAME = 'downloads';
const CITY_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz';
const CITY_ZIP_FILENAME = 'GeoLite2-City.tar.gz';
const CITY_DB_FILENAME = 'GeoLite2-City.mmdb';

const downloads = [
  // { url: ASN_URL, filename: ASN_FILENAME },
  { url: CITY_URL, archiveFilename: CITY_ZIP_FILENAME, dbFileName: CITY_DB_FILENAME, defaultLookup: true },
];

let lookup: Reader<CityResponse>;

export async function initMaxMind(rootDir: string, force = false) {
  if (force || !lookup) {
    const filePath = path.join(rootDir, FOLDER_NAME, CITY_DB_FILENAME);
    logger.info(`Initializing database: ${filePath}`);
    lookup = await maxMind.open<CityResponse>(filePath);
  }
}

export async function downloadMaxMindDb(rootDir: string): Promise<void> {
  const downloadFolderPath = path.join(rootDir, FOLDER_NAME);
  logger.info(`Downloading MaxMind DB to ${downloadFolderPath}`);

  // Create downloads directory if it doesn't exist
  if (!(await existsAsync(downloadFolderPath))) {
    await mkdirAsync(downloadFolderPath, { recursive: true });
  }

  for (const { defaultLookup, archiveFilename, url } of downloads) {
    const archiveFilePath = path.join(downloadFolderPath, archiveFilename);

    // Check if file needs to be downloaded
    let needsDownload = true;
    if (await existsAsync(archiveFilePath)) {
      const stats = await statAsync(archiveFilePath);
      const fileAge = Date.now() - stats.atime.getTime();
      const oneDayInMs = 24 * 60 * 60 * 1000;

      if (fileAge < oneDayInMs) {
        needsDownload = false;
      }
    }

    if (needsDownload) {
      logger.info(`Fetching from server: ${url}`);
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.MAX_MIND_ACCOUNT_ID}:${process.env.MAX_MIND_LICENSE_KEY}`).toString(
            'base64'
          )}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to download ${archiveFilePath}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFileAsync(archiveFilePath, buffer);
    } else {
      logger.info(`File already exists, skipping download: ${url}`);
    }

    // Extract .mmdb files from tar.gz
    await tar.x({
      file: archiveFilePath,
      cwd: downloadFolderPath,
      filter: (path) => path.endsWith('.mmdb'),
      strip: 1, // Remove the first directory component from paths
    });

    if (defaultLookup) {
      initMaxMind(downloadFolderPath, true);
    }
  }
}

export function lookupIpAddress(ipAddress: string) {
  if (!lookup) {
    throw new Error('MaxMind DB not initialized');
  }

  const results = lookup.get(ipAddress);
  if (!results) {
    return null;
  }
  return {
    city: results.city?.names?.en ?? null,
    country: results.country?.names?.en ?? null,
    countryISO: results.country?.iso_code ?? null,
    isEU: !!results.country?.is_in_european_union,
    continent: results.continent?.names?.en ?? null,
    location: results.location ?? null,
    postalCode: results.postal?.code ?? null,
    registeredCountry: results.registered_country
      ? {
          country: results.registered_country.names.en,
          iso: results.registered_country.iso_code,
          isEU: !!results.registered_country.is_in_european_union,
        }
      : null,
    subdivisions:
      results.subdivisions?.map((item) => ({
        name: item.names.en,
        iso: item.iso_code,
      })) ?? [],
    foo: results.traits,
  };
}

export function validateIpAddress(ipAddress: unknown): boolean {
  if (typeof ipAddress !== 'string') {
    return false;
  }
  return maxMind.validate(ipAddress);
}
