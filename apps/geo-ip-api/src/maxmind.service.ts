import { logger } from '@jetstream/api-config';
import fs from 'fs';
import maxMind, { AsnResponse, CityResponse, Reader } from 'maxmind';
import path from 'path';
import * as tar from 'tar';
import { promisify } from 'util';

const existsAsync = promisify(fs.exists);
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);
const mkdirAsync = promisify(fs.mkdir);

const ASN_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz';
const ASN_FILENAME = 'GeoLite2-ASN.tar.gz';
const ASN_DB_FILENAME = 'GeoLite2-ASN.mmdb';

const FOLDER_NAME = 'downloads';
const CITY_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz';
const CITY_ZIP_FILENAME = 'GeoLite2-City.tar.gz';
const CITY_DB_FILENAME = 'GeoLite2-City.mmdb';

const downloads = [
  { url: ASN_URL, archiveFilename: ASN_FILENAME, dbFileName: ASN_DB_FILENAME },
  { url: CITY_URL, archiveFilename: CITY_ZIP_FILENAME, dbFileName: CITY_DB_FILENAME },
];

let lookupAsn: Reader<AsnResponse>;
let lookupCity: Reader<CityResponse>;

export async function initMaxMind(rootDir: string, force = false) {
  if (force || !lookupAsn) {
    const filePath = path.join(rootDir, FOLDER_NAME, ASN_DB_FILENAME);
    logger.info(`Initializing ASN database: ${filePath}`);
    lookupAsn = await maxMind.open<AsnResponse>(filePath);
  }
  if (force || !lookupCity) {
    const filePath = path.join(rootDir, FOLDER_NAME, CITY_DB_FILENAME);
    logger.info(`Initializing CITY database: ${filePath}`);
    lookupCity = await maxMind.open<CityResponse>(filePath);
  }
}

export async function downloadMaxMindDb(rootDir: string): Promise<void> {
  const downloadFolderPath = path.join(rootDir, FOLDER_NAME);
  logger.info(`Downloading MaxMind DB to ${downloadFolderPath}`);

  // Create downloads directory if it doesn't exist
  if (!(await existsAsync(downloadFolderPath))) {
    await mkdirAsync(downloadFolderPath, { recursive: true });
  }

  for (const { archiveFilename, url } of downloads) {
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
            'base64',
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
  }
  await initMaxMind(rootDir, true);
}

export function lookupIpAddress(ipAddress: string) {
  if (!lookupAsn || !lookupCity) {
    throw new Error('MaxMind DB not initialized');
  }

  const asnResults = lookupAsn.get(ipAddress);
  const cityResults = lookupCity.get(ipAddress);
  if (!cityResults) {
    return {
      query: ipAddress,
      status: 'fail',
    };
  }

  return {
    query: ipAddress,
    status: 'success',
    continent: cityResults.continent?.names?.en ?? null,
    continentCode: cityResults.continent?.code ?? null,
    country: cityResults.country?.names?.en ?? null,
    countryCode: cityResults.country?.iso_code ?? null,
    region: cityResults.subdivisions?.[0]?.iso_code ?? null,
    regionName: cityResults.subdivisions?.[0]?.names?.en ?? null,
    city: cityResults.city?.names?.en ?? null,
    zip: cityResults.postal?.code ?? null,
    lat: cityResults.location?.latitude ?? null,
    lon: cityResults.location?.longitude ?? null,
    timezone: cityResults.location?.time_zone ?? null,
    isEU: !!cityResults.country?.is_in_european_union,
    isp: cityResults.traits?.isp ?? null,
    org: cityResults.traits?.organization ?? asnResults?.autonomous_system_organization ?? null,
    proxy: cityResults.traits?.is_anonymous_proxy ?? false,
  };
}

export function validateIpAddress(ipAddress: unknown): boolean {
  if (typeof ipAddress !== 'string') {
    return false;
  }
  return maxMind.validate(ipAddress);
}
