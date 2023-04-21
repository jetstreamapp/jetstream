/* eslint-disable @typescript-eslint/no-non-null-assertion */
/**
MIT License

Copyright (c) 2019 robbederks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

https://github.com/robbederks/downzip
(NOTE: this was heavily modified)
 */
import { logger } from './app/Logger';
import Zip from './app/Zip';
import ZipUtils from './app/ZipUtils';

declare const self: ServiceWorkerGlobalScope;

interface DownZipFile {
  name: string;
  downloadUrl: string;
  size: number;
}

// /////////// GLOBAL OBJECTS /////////// //
const zipMap: Map<
  string,
  {
    files: DownZipFile[];
    name: string;
    zip: Zip;
    sizeBig: BigInt;
  }
> = new Map();

// COMMANDS
const ACKNOWLEDGE = 'ACKNOWLEDGE';
const ACTIVE_DOWNLOADS = 'ACTIVE_DOWNLOADS';

//////// MESSAGE HANDLERS
const initialize = (data: any, ports: readonly MessagePort[]) => {
  logger.log('[SW]', `Initialize`, { data });
  const { id, files, name } = data;

  // Decide whether to use zip64
  const totalSizeBig = ZipUtils.calculateSize(files);
  logger.log('[SW]', `Total estimated file size: ${totalSizeBig}`);
  const zip64 = totalSizeBig >= BigInt('0xFFFFFFFF');

  // Start new Zip object and add to the map
  zipMap.set(id, { files, name, zip: new Zip(zip64), sizeBig: totalSizeBig });

  // Acknowledge reception
  if (ports.length > 0) {
    ports[0].postMessage({ command: ACKNOWLEDGE });
  }
};

// This message is here to keep the service worker from getting killed while downloading.
const tick = (data: any, ports: readonly MessagePort[]) => {
  logger.log('[SW]', `Tock`);
  if (ports.length > 0) {
    ports[0].postMessage({ command: ACTIVE_DOWNLOADS, activeIds: Array.from(zipMap.keys()) });
  }
};

const messageHandlers = {
  INITIALIZE: initialize,
  TICK: tick,
};

// /////////// EVENT HANDLERS /////////// //
self.addEventListener('install', (event) => {
  logger.log('[SW]', 'Installing worker and skip waiting', { event });
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  logger.log('[SW]', 'Activating worker and skip waiting', { event });
  self.skipWaiting();
  self.clients.claim();
});

/**
 * INTERCEPT FETCH EVENTS
 */
self.addEventListener('fetch', async (event) => {
  // Get URL and check if it is a download request
  const urlParts = event.request.url.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  if (lastPart.includes('download-')) {
    // Get download id
    const id = lastPart.replace('download-', '');
    logger.log('[SW]', `Fetch called for download id: ${id}`);

    // Check if initialized
    if (!zipMap.has(id)) {
      logger.error('[SW][ERROR]', `No zip initialized for id: ${id}`);
      return;
    }

    // Respond with the zip outputStream
    event.respondWith(
      new Response(zipMap.get(id)!.zip.outputStream, {
        headers: new Headers({
          'Content-Type': 'application/octet-stream; charset=utf-8',
          'Content-Disposition': `attachment; filename="${zipMap.get(id)!.name}.zip"`,
          'Content-Length': zipMap.get(id)!.sizeBig.toString(), // This is an approximation, does not take into account the headers
        }),
      })
    );

    // Start feeding zip the downloads
    for (const file of zipMap.get(id)!.files) {
      // Start new file in the zip
      zipMap.get(id)!.zip.startFile(file.name);

      // Append all the downloaded data
      try {
        await new Promise<void>((resolve, reject) => {
          fetch(file.downloadUrl)
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
                  zipMap.get(id)!.zip.appendData(value);
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
      zipMap.get(id)!.zip.endFile();
    }

    // End zip
    zipMap.get(id)!.zip.finish();
    zipMap.delete(id);
    logger.log('[SW]', 'Done with zip', id);
  } else {
    logger.log('[SW]', 'Fetch called for a non-download. Doing nothing');
  }
});

self.addEventListener('error', (event) => {
  logger.log('[SW]', `Error: ${event.message} at line number: ${event.lineno}. Handling URL ${event.filename}`);
  return true;
});

self.addEventListener('message', async (event) => {
  const { data, ports } = event;
  const handler = messageHandlers[data.command];
  if (handler) {
    await handler(data.data, ports);
  } else {
    logger.error('[SW][ERROR]', `Handler for command does not exist: ${data.command}`);
  }
});
