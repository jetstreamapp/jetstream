/**
 * This file is based on the Salesforce Inspector extension for Chrome. (MIT license)
 * Credit: https://github.com/sorenkrabbe/Chrome-Salesforce-inspector/blob/master/addon/background.js
 */
/// <reference lib="WebWorker" />
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import browser from 'webextension-polyfill';
import { extensionRoutes } from '../controllers/extension.routes';
import { initApiClient } from './api-client';
import { OrgAndSessionInfo } from './extension.types';
import { Zip, ZipUtils } from './zip';

// COMMANDS
const ACKNOWLEDGE = 'ACKNOWLEDGE';
const ACTIVE_DOWNLOADS = 'ACTIVE_DOWNLOADS';

interface DownZipFile {
  name: string;
  downloadUrl: string;
  size: number;
  baseUrl: string;
}

// /////////// GLOBAL OBJECTS /////////// //
const zipMap: Map<
  string,
  {
    files: DownZipFile[];
    name: string;
    zip: Zip;
    sizeBig: bigint;
  }
> = new Map();

const initialize = (data: any, ports: browser.Runtime.Port) => {
  logger.log('[SW]', `Initialize`, { data });
  const { id, files, name } = data;

  // Decide whether to use zip64
  const totalSizeBig = ZipUtils.calculateSize(files);
  logger.log('[SW]', `Total estimated file size: ${totalSizeBig}`);
  const zip64 = totalSizeBig >= BigInt('0xFFFFFFFF');

  // Start new Zip object and add to the map
  zipMap.set(id, { files, name, zip: new Zip(zip64), sizeBig: totalSizeBig });

  // Acknowledge reception
  if (ports) {
    ports.postMessage({ command: ACKNOWLEDGE });
  }
};

// This message is here to keep the service worker from getting killed while downloading.
const tick = (data: any, port: browser.Runtime.Port) => {
  logger.log('[SW]', `Tock`);
  if (port) {
    port.postMessage({ command: ACTIVE_DOWNLOADS, activeIds: Array.from(zipMap.keys()) });
  }
};

const messageHandlers = {
  INITIALIZE: initialize,
  TICK: tick,
};

browser.runtime.onConnect.addListener((port) => {
  port.onMessage.addListener(onMessage);
  port.onDisconnect.addListener(deleteTimer);
  // port._timer = setTimeout(forceReconnect, 250e3, port);
});

async function onMessage(
  {
    command,
    data,
  }: {
    command: string;
    data: {
      id: string;
      name: string;
      files: { downloadUrl: string; name: string; size: number }[];
    } | null;
  },
  port: browser.Runtime.Port,
) {
  const handler = messageHandlers[command];
  if (handler) {
    await handler(data, port);
  } else {
    logger.error('[SW][ERROR]', `Handler for command does not exist: ${command}`);
  }
}

function deleteTimer(port) {
  if (port._timer) {
    clearTimeout(port._timer);
    delete port._timer;
  }
}

export function handleDownloadZipFiles(url: URL, event: FetchEvent, connections: Record<string, OrgAndSessionInfo>) {
  const urlParts = url.pathname.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  if (!lastPart.includes('download-')) {
    return;
  }
  const id = lastPart.replace('download-', '');
  logger.log('[SW]', `Fetch called for download id: ${id}`);
  const zipItem = zipMap.get(id);
  if (!zipItem) {
    logger.error('[SW][ERROR]', `No zip initialized for id: ${id}`);
    return;
  }

  // Respond with the zip outputStream
  event.respondWith(
    new Response(zipItem.zip.outputStream, {
      headers: new Headers({
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Content-Disposition': `attachment; filename="${zipItem.name}.zip"`,
        'Content-Length': zipItem.sizeBig.toString(), // This is an approximation, does not take into account the headers
      }),
    }),
  );

  downloadAllZipFiles(id, event, connections);
}

async function downloadAllZipFiles(id: string, event: FetchEvent, connections: Record<string, OrgAndSessionInfo>) {
  const zipItem = zipMap.get(id);
  if (!zipItem) {
    logger.error('[SW][ERROR]', `No zip initialized for id: ${id}`);
    return;
  }

  // Start feeding zip the downloads
  for (const file of zipItem.files) {
    const url = new URL(`invalid://${file.downloadUrl}`);
    const orgId = url.searchParams.get(HTTP.HEADERS.X_SFDC_ID);
    if (!orgId) {
      logger.error('[SW][ERROR]', `No orgId found in downloadUrl: ${file.downloadUrl}`);
      return;
    }
    const { sessionInfo, org } = connections[orgId];
    const apiConnection = initApiClient(sessionInfo);

    // Start new file in the zip
    zipItem.zip.startFile(file.name);

    // Append all the downloaded data
    try {
      const route = extensionRoutes.match('GET', url.pathname);

      if (!route) {
        logger.error('[SW][ERROR]', `No route found for ${file.downloadUrl}`);
        return null;
      }

      await new Promise<void>((resolve, reject) => {
        route
          .handler({
            request: event.request,
            params: route.params,
            jetstreamConn: apiConnection,
            org,
            urlOverride: url,
          })
          .then((response) => response.body)
          .then(async (stream) => {
            if (!stream) {
              return;
            }
            const reader = stream.getReader();
            let doneReading = false;
            while (!doneReading) {
              const chunk = await reader.read();
              const { done, value } = chunk;

              if (done) {
                // If this stream has finished, resolve and return
                resolve();
                doneReading = true;
              } else {
                // If not, append data to the zip
                zipItem.zip.appendData(value);
              }
            }
          })
          .catch((err) => {
            reject(err);
          });
      });
    } catch (ex) {
      logger.error('[SW][ERROR]', `Error while piping data into zip: ${ex.message}`);
    }

    // End file
    zipItem.zip.endFile();
  }

  // End zip
  zipItem.zip.finish();
  zipMap.delete(id);
  logger.log('[SW]', 'Done with zip', id);
}
