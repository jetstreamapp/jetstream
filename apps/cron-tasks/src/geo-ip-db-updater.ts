import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { Open } from 'unzipper';
import { promisify } from 'util';
import { ENV } from './config/env-config';
import { logger } from './config/logger.config';
import { getExceptionLog } from './utils/utils';

/**

NOTICE: this is no longer used in production as put too much strain on the database server

CREATE TABLE IF NOT EXISTS geo_ip.network (
	network cidr NOT NULL,
	geoname_id int,
	registered_country_geoname_id int,
	represented_country_geoname_id int,
	is_anonymous_proxy bool,
	is_satellite_provider bool,
	postal_code text,
	latitude numeric,
	longitude numeric,
	accuracy_radius int,
	is_anycast bool
);

CREATE TABLE IF NOT EXISTS geo_ip.location (
	geoname_id int NOT NULL,
	locale_code text NOT NULL,
	continent_code text,
	continent_name text,
	country_iso_code text,
	country_name text,
	subdivision_1_iso_code text,
	subdivision_1_name text,
	subdivision_2_iso_code text,
	subdivision_2_name text,
	city_name text,
	metro_code int,
	time_zone text,
	is_in_european_union bool NOT NULL,
	PRIMARY KEY (geoname_id, locale_code)
);

CREATE TABLE IF NOT EXISTS geo_ip.organization (
	network cidr NOT NULL,
	autonomous_system_number int,
	autonomous_system_organization text
);

CREATE INDEX idx_geoip2_network_network ON geo_ip.network USING gist (network inet_ops);
CREATE INDEX idx_geoip2_network_geoname_id ON geo_ip.network(geoname_id);
CREATE INDEX idx_geoip2_location_locale_code ON geo_ip.location (locale_code);
CREATE INDEX idx_geoip2_organization_network ON geo_ip.organization USING gist (network inet_ops);

*/

const execAsync = promisify(exec);

if (!ENV.MAX_MIND_ACCOUNT_ID || !ENV.MAX_MIND_LICENSE_KEY) {
  logger.error('Missing MaxMind credentials');
  process.exit(1);
}

const ASN_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-ASN-CSV/download?suffix=zip';
const ASN_FILENAME = 'GeoLite2-ASN.zip';
const ASN_FILENAMES = ['GeoLite2-ASN-Blocks-IPv4.csv', 'GeoLite2-ASN-Blocks-IPv6.csv'];

const CITY_URL = 'https://download.maxmind.com/geoip/databases/GeoLite2-City-CSV/download?suffix=zip';
const CITY_FILENAME = 'GeoLite2-City.zip';
const CITY_FILENAMES = ['GeoLite2-City-Locations-en.csv', 'GeoLite2-City-Blocks-IPv4.csv', 'GeoLite2-City-Blocks-IPv6.csv'];

async function importCSVToTable(csvPath: string, tableName: string, schema: string, createTemp: boolean): Promise<void> {
  const tempTableName = `${tableName}_temp`;
  const fullTempTableName = `${schema}.${tempTableName}`;
  const fullTableName = `${schema}.${tableName}`;

  try {
    // Only create temp table if requested (first file)
    if (createTemp) {
      logger.info(`Creating temporary table ${fullTempTableName}`);
      await execAsync(`psql "${ENV.JETSTREAM_POSTGRES_DBURI}" -c "DROP TABLE IF EXISTS ${fullTempTableName}"`);
      await execAsync(
        `psql "${ENV.JETSTREAM_POSTGRES_DBURI}" -c "CREATE TABLE ${fullTempTableName} (LIKE ${fullTableName} INCLUDING ALL)"`
      );
    }

    // Import CSV data
    logger.info(`Importing ${csvPath} to ${fullTempTableName}`);
    await execAsync(`psql "${ENV.JETSTREAM_POSTGRES_DBURI}" -c "\\COPY ${fullTempTableName} FROM '${csvPath}' WITH (FORMAT CSV, HEADER)"`);
  } catch (error) {
    logger.error(getExceptionLog(error), `Error importing ${csvPath}: %s`, error.message);
    throw error;
  }
}

async function swapTables(tableName: string, schema: string): Promise<void> {
  const tempTableName = `${tableName}_temp`;
  const fullTempTableName = `${schema}.${tempTableName}`;
  const fullTableName = `${schema}.${tableName}`;

  try {
    // Atomic swap
    await execAsync(`
      psql "${ENV.JETSTREAM_POSTGRES_DBURI}" -c "
        BEGIN;
        DROP TABLE IF EXISTS ${fullTableName};
        ALTER TABLE ${fullTempTableName} RENAME TO ${tableName};
        COMMIT;
      "
    `);
    logger.info(`Successfully swapped ${fullTempTableName} to ${fullTableName}`);
  } catch (error) {
    logger.error(getExceptionLog(error), `Error swapping tables: %s`, error.message);
    // Cleanup temp table if it exists
    await execAsync(`psql "${ENV.JETSTREAM_POSTGRES_DBURI}" -c "DROP TABLE IF EXISTS ${fullTempTableName}"`).catch(() => {
      logger.warn(`Failed to drop table ${fullTempTableName}`);
    });
    throw error;
  }
}

async function processFile(
  url: string,
  zipFileName: string,
  filenames: string[],
  processor: (filename: string, filePath: string) => Promise<void>
) {
  const downloadDir = path.join(__dirname, '../../downloads');
  const zipFilePath = path.join(downloadDir, zipFileName);

  // Create downloads directory if it doesn't exist
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  let buffer: Buffer;

  // Check if file exists and is less than 24 hours old
  if (fs.existsSync(zipFilePath)) {
    const stats = fs.statSync(zipFilePath);
    const fileAge = Date.now() - stats.mtime.getTime();
    const oneDayInMs = 24 * 60 * 60 * 1000;

    if (fileAge < oneDayInMs) {
      logger.info(`Using existing file ${zipFilePath}`);
      buffer = fs.readFileSync(zipFilePath);
    } else {
      buffer = await downloadFile(url, zipFilePath);
    }
  } else {
    buffer = await downloadFile(url, zipFilePath);
  }

  const directory = await Open.buffer(buffer);

  for (const entry of directory.files) {
    const currentFilename = entry.path.split('/').reverse()[0];
    if (filenames.includes(currentFilename)) {
      logger.info(`Extracting ${entry.path}...`);
      const csvPath = path.join(downloadDir, currentFilename);
      const writeStream = fs.createWriteStream(csvPath);
      await new Promise((resolve, reject) => {
        entry.stream().pipe(writeStream).on('finish', resolve).on('error', reject);
      });
      await processor(currentFilename, csvPath);
      // Cleanup CSV file
      fs.unlinkSync(csvPath);
    }
  }
}

async function downloadFile(url: string, savePath: string): Promise<Buffer> {
  logger.info(`Downloading from ${url}...`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${ENV.MAX_MIND_ACCOUNT_ID}:${ENV.MAX_MIND_LICENSE_KEY}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const buffer = await streamToBuffer(response.body!);
  fs.writeFileSync(savePath, buffer);
  return buffer;
}

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const reader = stream.getReader();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

const tempTablesNeedToBeCreated = {
  network: true,
  location: true,
  organization: true,
};

async function processNetwork(filename: string, csvPath: string) {
  await importCSVToTable(csvPath, 'network', 'geo_ip', tempTablesNeedToBeCreated.network);
  tempTablesNeedToBeCreated.network = false;
}

async function processLocation(csvPath: string) {
  await importCSVToTable(csvPath, 'location', 'geo_ip', tempTablesNeedToBeCreated.location);
  tempTablesNeedToBeCreated.location = false;
}

async function processASN(filename: string, csvPath: string) {
  await importCSVToTable(csvPath, 'organization', 'geo_ip', tempTablesNeedToBeCreated.organization);
  tempTablesNeedToBeCreated.organization = false;
}

async function cleanupTempTables(): Promise<void> {
  const tables = ['network', 'location', 'organization'];

  for (const table of tables) {
    const tempTableName = `geo_ip.${table}_temp`;
    try {
      await execAsync(`psql "${ENV.JETSTREAM_POSTGRES_DBURI}" -c "DROP TABLE IF EXISTS ${tempTableName}"`);
      logger.info(`Cleaned up temporary table ${tempTableName}`);
    } catch (error) {
      logger.warn(`Failed to drop temporary table ${tempTableName}: ${error.message}`);
    }
  }
}

async function main() {
  try {
    logger.info('Starting GeoIP database update...');

    // Clean up any leftover temp tables first
    await cleanupTempTables();

    // Process ASN data
    await processFile(ASN_URL, ASN_FILENAME, ASN_FILENAMES, async (filename, csvPath) => {
      await processASN(filename, csvPath);
    });
    // Swap ASN tables after all files are processed
    await swapTables('organization', 'geo_ip');

    // Process City data
    await processFile(CITY_URL, CITY_FILENAME, CITY_FILENAMES, async (filename, csvPath) => {
      if (filename.includes('Blocks')) {
        await processNetwork(filename, csvPath);
      } else if (filename.includes('Locations')) {
        await processLocation(csvPath);
      }
    });
    // Swap network/location tables after all files are processed
    await swapTables('location', 'geo_ip');
    await swapTables('network', 'geo_ip');

    logger.info('GeoIP database update completed successfully');
  } catch (error) {
    logger.error(getExceptionLog(error), 'Error updating GeoIP database: %s', error.message);
    throw error;
  }
}

main().catch((error) => {
  logger.error(getExceptionLog(error), 'Fatal error: %s', error.message);
  process.exit(1);
});
