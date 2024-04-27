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
import { logger } from '@jetstream/shared/client-logger';
import uniqueId from 'lodash/uniqueId';

export interface DownZipFile {
  name: string;
  downloadUrl: string;
  size: number;
}

const swScope = 'jetstream-download-zip';
const TIMEOUT_MS = 5000;
const KEEPALIVE_INTERVAL_MS = 5000;
const CMD_ACKNOWLEDGE = 'ACKNOWLEDGE';
const CMD_ACTIVE_DOWNLOADS = 'ACTIVE_DOWNLOADS';

let downzip: DownZip;

export async function getZipDownloadUrl(zipFileName: string, files: DownZipFile[]) {
  if (!downzip) {
    downzip = new DownZip();
    await downzip.register();
  }
  return await downzip.getDownloadUrl(zipFileName, files);
}

export async function cancelZipDownload(url: string) {
  if (downzip) {
    downzip.cancelDownload(url);
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const filename = `/download-zip.sw.js`;
    const registration = await navigator.serviceWorker.register(filename, { scope: `./${swScope}/` });
    logger.log('[SW CLIENT][REGISTRATION][SUCCESS]', registration.scope);
    return registration;
  } else {
    throw new Error('Your browser does not support this feature.');
  }
}

/**
 * The class managed an interaction with a service worker to stream multiple files and put them into a zip file.
 * A URL is generated and given to the service worker to listen to, and uses that to know what files to obtain
 */
class DownZip {
  private worker: ServiceWorker | null;
  private intervalTimers: any[] = [];
  private activeDownloads = new Set();

  constructor() {
    this.worker = null;
  }

  /**
   * Keep the worker alive while the download is in progress
   * This was implemented in the lib used for the foundation, I did not validate 100% that it would cause problems or not to remove
   */
  keepAlive() {
    this.intervalTimers.push(
      setInterval(async () => {
        // When the download finishes, remove the interval timer
        // since the port is transferred to the worker, it can only be used once unless the worker kept track of it
        const messageChannel = new MessageChannel();
        const eventHandler = (event: MessageEvent<any>) => {
          logger.log('[SW CLIENT][EVENT]', event.data);
          // when downloads finish, we remove our activeIds that we were tracking
          if (event.data.command === CMD_ACTIVE_DOWNLOADS) {
            const activeDownloadIds = new Set(event.data.activeIds);
            Array.from(this.activeDownloads).forEach((id) => {
              if (!activeDownloadIds.has(id)) {
                this.activeDownloads.delete(id);
              }
            });
            if (!this.activeDownloads.size) {
              logger.log('NO ACTIVE DOWNLOADS');
              this.intervalTimers.forEach((timer) => clearInterval(timer));
            }
            messageChannel.port1.removeEventListener('message', eventHandler);
            messageChannel.port1.close();
          }
        };
        messageChannel.port1.addEventListener('message', eventHandler);
        messageChannel.port1.start();

        this.sendMessage('TICK', null, messageChannel.port2);
      }, KEEPALIVE_INTERVAL_MS)
    );
  }

  async register() {
    // Register service worker and let it intercept our scope
    const result = await registerServiceWorker();
    logger.log('[DownZip] Service worker registered successfully:', result);
    this.worker = result.installing || result.active;
    if (this.worker) {
      this.worker.onerror = (event) => {
        logger.error('[DownZip][SW ERROR] There was an error with our service worker', {
          message: event.message,
          error: event.error,
          filename: event.filename,
        });
      };
    }
  }

  sendMessage(command: string, data?: any, port?: Transferable) {
    if (this.worker) {
      port ? this.worker.postMessage({ command, data }, [port]) : this.worker.postMessage({ command, data });
    }
  }

  cancelDownload(url: string) {
    if (!url) {
      return;
    }
    const parts = url.split('/download-');
    this.activeDownloads.delete(parts[parts.length - 1]);
  }

  async getDownloadUrl(zipFileName: string, files: DownZipFile[]): Promise<string> {
    // Check if worker got created in the constructor
    if (!this.worker) {
      logger.error('[DownZip] No service worker registered!');
      throw new Error('Service worker is not registered, download link cannot be generated.');
    }
    const id = uniqueId('download-zip');

    this.activeDownloads.add(id);
    this.keepAlive();

    logger.log('Downloading as zip', { id, zipFileName, files });

    return new Promise((resolve, reject) => {
      // Return download URL on acknowledge via messageChannel
      const messageChannel = new MessageChannel();
      const eventHandler = (event: MessageEvent<any>) => {
        if (event.data.command === CMD_ACKNOWLEDGE) {
          resolve(`${swScope}/download-${id}`);
          messageChannel.port1.removeEventListener('message', eventHandler);
          messageChannel.port1.close();
        }
      };
      messageChannel.port1.addEventListener('message', eventHandler);
      messageChannel.port1.start();

      // Init this task in our service worker
      this.sendMessage(
        'INITIALIZE',
        {
          id,
          files,
          name: zipFileName,
        },
        messageChannel.port2
      );

      // Start timeout timer
      setTimeout(reject, TIMEOUT_MS);
    });
  }
}
