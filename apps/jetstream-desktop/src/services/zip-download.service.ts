import { DownloadZipProgress } from '@jetstream/desktop/types';
import { ApiConnection, BinaryFileDownload } from '@jetstream/salesforce-api';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { app, dialog, WebContents } from 'electron';
import logger from 'electron-log';
import { createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { getUserPreferences } from './persistence.service';

/**
 * Downloads multiple binary files from Salesforce and zips them directly to disk
 * Shows progress to the user and saves to the user's configured download location
 */
export async function downloadAndZipFilesToDisk(
  jetstreamConn: ApiConnection,
  files: BinaryFileDownload[],
  zipFileName: string,
  jobId: string,
  sender?: Maybe<WebContents>,
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // Get download location from user preferences or prompt user
    const downloadPreferences = getUserPreferences().fileDownload;
    let downloadPath: string;

    if (downloadPreferences?.omitPrompt && downloadPreferences?.downloadPath && existsSync(downloadPreferences.downloadPath)) {
      downloadPath = join(downloadPreferences.downloadPath, zipFileName);
    } else {
      const defaultPath = app.getPath('downloads');
      const result = await dialog.showSaveDialog({
        title: 'Save Zip File',
        defaultPath: join(defaultPath, zipFileName),
        filters: [{ name: 'Zip Files', extensions: ['zip'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Download canceled by user' };
      }

      downloadPath = result.filePath;
    }

    // Use the downloadAndZipFiles method from the salesforce-api library
    const zipResult = await jetstreamConn.binary.downloadAndZipFiles(files, zipFileName);

    // Track progress
    let bytesDownloaded = 0;
    const totalBytes = Number(zipResult.size);
    let currentFileIndex = 0;

    // Create write stream for the zip file
    const writeStream = createWriteStream(downloadPath);

    // Convert web stream to Node.js readable stream
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = Readable.fromWeb(zipResult.stream as any);

    // Track progress as chunks are written
    nodeStream.on('data', (chunk: Buffer) => {
      bytesDownloaded += chunk.length;
      const percentComplete = Math.round((bytesDownloaded / totalBytes) * 100);

      // Estimate current file (this is approximate since we don't know exact boundaries)
      const estimatedCurrentFile = Math.min(Math.floor((bytesDownloaded / totalBytes) * files.length), files.length - 1);

      if (estimatedCurrentFile !== currentFileIndex) {
        currentFileIndex = estimatedCurrentFile;
      }

      const progress: DownloadZipProgress = {
        currentFile: currentFileIndex + 1,
        totalFiles: files.length,
        fileName: files[currentFileIndex]?.fileName || zipFileName,
        bytesDownloaded,
        totalBytes,
        percentComplete,
        jobId,
      };

      // Send progress update to renderer
      sender?.send('download-progress', progress);
    });

    // Pipe the stream to file
    await pipeline(nodeStream, writeStream);

    logger.info(`Zip file downloaded successfully: ${downloadPath}`);
    app.addRecentDocument(downloadPath);

    return { success: true, filePath: downloadPath };
  } catch (error) {
    logger.error('Error downloading and zipping files', getErrorMessageAndStackObj(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}
