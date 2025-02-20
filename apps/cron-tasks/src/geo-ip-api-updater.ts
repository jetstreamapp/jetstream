/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ENV } from './config/env-config';
import { logger } from './config/logger.config';
import { getExceptionLog } from './utils/utils';

const GEO_IP_API_HOSTNAME = ENV.GEO_IP_API_HOSTNAME!;
const GEO_IP_API_USERNAME = ENV.GEO_IP_API_USERNAME!;
const GEO_IP_API_PASSWORD = ENV.GEO_IP_API_PASSWORD!;

if (!GEO_IP_API_HOSTNAME) {
  logger.error('GEO_IP_API_HOSTNAME environment variable is not set');
  process.exit(1);
}
if (!GEO_IP_API_USERNAME) {
  logger.error('GEO_IP_API_USERNAME environment variable is not set');
  process.exit(1);
}
if (!GEO_IP_API_PASSWORD) {
  logger.error('GEO_IP_API_PASSWORD environment variable is not set');
  process.exit(1);
}

async function initiateDownload() {
  const response = await fetch(`${GEO_IP_API_HOSTNAME}/api/download`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${GEO_IP_API_USERNAME}:${GEO_IP_API_PASSWORD}`).toString('base64')}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  return response.json();
}

async function main() {
  const results = await initiateDownload();
  logger.info(results, 'Download completed successfully');
}

main().catch((error) => {
  logger.error(getExceptionLog(error), 'Fatal error: %s', error.message);
  process.exit(1);
});
