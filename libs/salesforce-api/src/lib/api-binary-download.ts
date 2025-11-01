import { MAX_BINARY_DOWNLOAD_SIZE_BYTES } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { ApiConnection } from './connection';
import { SalesforceApi } from './utils';
import { StreamingZip, ZipUtils } from './zip-utils';

// Timeout for individual file downloads (5 minutes)
const FILE_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

export interface BinaryFileDownload {
  url: string;
  fileName: string;
  fileExtension?: string;
  size: number; // Size in bytes for the individual file
}

export interface DownloadZipOptions {
  files: BinaryFileDownload[];
  zipFileName?: string; // Name for the downloaded zip file (e.g., "attachments.zip")
}

export class ApiBinaryDownload extends SalesforceApi {
  constructor(connection: ApiConnection) {
    super(connection);
  }

  /**
   * Downloads multiple binary files from Salesforce and streams them into a zip file
   * Memory efficient: streams one file at a time to avoid holding files in memory
   * Web-compatible: uses ReadableStream API that works in both Node.js and browsers
   *
   * @param files - Array of files to download with their SFDC URLs and desired filenames
   * @returns Object with the zip stream and metadata (filename, size)
   */
  async downloadAndZipFiles(
    files: BinaryFileDownload[],
    zipFileName = 'download.zip',
  ): Promise<{
    stream: ReadableStream<Uint8Array>;
    fileName: string;
    size: bigint;
  }> {
    // Calculate total size for proper download progress
    const totalSize = files.reduce((acc, file) => acc + BigInt(file.size), BigInt(0));
    const useZip64 = totalSize > BigInt(0xffffffff);

    // TODO: if we hit this, the user is never notified - ideally we would have a way to inform them before starting the download
    // But all the solutions are complicated, require server state, or lose the streaming download benefit
    if (totalSize > BigInt(MAX_BINARY_DOWNLOAD_SIZE_BYTES)) {
      throw new Error(
        `The total size of the files exceeds the maximum allowed size of ${MAX_BINARY_DOWNLOAD_SIZE_BYTES / (1024 * 1024)} MB.`,
      );
    }

    // Get filename with extension and ensure uniqueness within the zip
    const usedFileNames = new Set<string>();
    files = files.map((file) => {
      let newFileName = `${file.fileName}${file.fileExtension ? `.${file.fileExtension}` : ''}`;
      let counter = 1;
      while (usedFileNames.has(newFileName)) {
        newFileName = `${file.fileName} (${counter++})${file.fileExtension ? `.${file.fileExtension}` : ''}`;
      }
      usedFileNames.add(newFileName);
      file.fileName = newFileName;
      return {
        ...file,
        fileName: newFileName,
      };
    });
    usedFileNames.clear();

    // Calculate the exact zip file size for Content-Length header
    const zipSize = ZipUtils.calculateZipSize(
      files.map(({ fileName, size }) => ({ name: fileName, size })),
      useZip64,
    );

    const zip = new StreamingZip(useZip64);

    // AbortController to cancel all downloads if client disconnects
    const abortController = new AbortController();

    // Register abort callback on zip stream cancellation (client disconnect)
    zip.onAbort(() => {
      this.logger.info('Client disconnected, aborting all downloads');
      abortController.abort();
    });

    // Process files sequentially to conserve memory
    // The zip format requires files to be added one at a time
    (async () => {
      try {
        for (const { url, fileName } of files) {
          // Check if client disconnected before starting next file
          if (zip.isAborted()) {
            this.logger.info('Zip stream aborted, stopping file processing');
            return;
          }

          try {
            await zip.startFile(fileName);

            // Create timeout promise that rejects after FILE_DOWNLOAD_TIMEOUT_MS
            const timeoutPromise = new Promise<never>((_, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error(`File download timed out after ${FILE_DOWNLOAD_TIMEOUT_MS / 1000} seconds: ${fileName}`));
              }, FILE_DOWNLOAD_TIMEOUT_MS);

              // Clear timeout if aborted
              abortController.signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
              });
            });

            // Race between actual download and timeout
            const stream = await Promise.race([
              this.apiRequest<ReadableStream<Uint8Array>>({
                sessionInfo: this.sessionInfo,
                url,
                outputType: 'stream',
              }),
              timeoutPromise,
            ]);

            // Check abort signal before processing stream
            if (abortController.signal.aborted) {
              this.logger.info('Download aborted while waiting for stream');
              return;
            }

            const reader = stream.getReader();
            try {
              while (true) {
                // Check abort signal before each read
                if (abortController.signal.aborted) {
                  this.logger.info('Download aborted during streaming');
                  reader.cancel();
                  return;
                }

                const { done, value } = await reader.read();
                if (done) {
                  break;
                }

                // Check abort signal before writing to zip
                if (abortController.signal.aborted) {
                  this.logger.info('Download aborted during zip writing');
                  reader.cancel();
                  return;
                }

                // appendData now handles backpressure automatically
                await zip.appendData(value);
              }
            } finally {
              reader.releaseLock();
            }

            await zip.endFile();
          } catch (error) {
            // Don't log errors if we aborted intentionally
            if (!abortController.signal.aborted) {
              this.logger.error(getErrorMessageAndStackObj(error), `Failed to download file: ${fileName}`);
            }
            throw error;
          }
        }

        // Only finish if not aborted
        if (!abortController.signal.aborted) {
          await zip.finish();
        }
      } catch (error) {
        // Don't log errors if we aborted intentionally
        if (!abortController.signal.aborted) {
          this.logger.error(getErrorMessageAndStackObj(error), 'Error while creating zip');
        }
        // Abort to clean up any pending operations
        zip.abort();
        throw error;
      }
    })();

    return {
      stream: zip.outputStream,
      fileName: zipFileName,
      size: zipSize,
    };
  }
}
