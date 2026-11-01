import { DownloadFileResult, DownloadZipProgress } from '@jetstream/desktop/types';
import { ApiConnection, BinaryFileDownload } from '@jetstream/salesforce-api';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { app, dialog, WebContents } from 'electron';
import logger from 'electron-log';
import { createWriteStream, existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { setRecentDocument, toSafeDownloadFileName } from '../utils/utils';
import { getUserPreferences } from './persistence.service';

function emitProgress(sender: Maybe<WebContents>, progress: DownloadZipProgress) {
  // Send progress update to renderer
  sender?.send('download-progress', progress);
}

/**
 * Write a download to disk. If the download fails part way, the partial file is removed so a truncated file
 * is never left behind looking like a complete download.
 * The file is only removed if it was actually opened - if opening fails (e.g. an existing read-only file),
 * nothing was written and the existing file must be left alone.
 */
async function writeDownloadToFile(source: Readable, filePath: string) {
  const fileStream = createWriteStream(filePath);
  let isFileOpened = false;
  fileStream.once('open', () => {
    isFileOpened = true;
  });
  try {
    await pipeline(source, fileStream);
  } catch (ex) {
    if (isFileOpened) {
      await rm(filePath, { force: true }).catch((removeError) => {
        logger.warn('Unable to remove partial download', getErrorMessageAndStackObj(removeError));
      });
    }
    throw ex;
  }
}

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
): Promise<DownloadFileResult> {
  try {
    // Get download location from user preferences or prompt user
    const downloadPreferences = getUserPreferences().fileDownload;
    let downloadPath: string;

    const safeZipFileName = toSafeDownloadFileName(zipFileName);
    if (
      downloadPreferences?.omitPrompt &&
      downloadPreferences?.downloadPath &&
      existsSync(downloadPreferences.downloadPath) &&
      safeZipFileName
    ) {
      downloadPath = join(downloadPreferences.downloadPath, safeZipFileName);
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
    const zipResult = await jetstreamConn.binary.downloadAndZipFiles(files, zipFileName, true);

    // Track progress
    let bytesDownloaded = 0;
    const totalBytes = Number(zipResult.size);
    let currentFileIndex = 0;

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

      // Send progress update to renderer
      emitProgress(sender, {
        currentFile: currentFileIndex + 1,
        totalFiles: files.length,
        fileName: files[currentFileIndex]?.fileName || zipFileName,
        bytesDownloaded,
        totalBytes,
        percentComplete,
        jobId,
      });
    });

    await writeDownloadToFile(nodeStream, downloadPath);

    logger.info(`Zip file downloaded successfully: ${downloadPath}`);
    setRecentDocument(downloadPath);

    return { success: true, filePath: downloadPath };
  } catch (error) {
    logger.error('Error downloading and zipping files', getErrorMessageAndStackObj(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}

export async function downloadBulkApiFileAndSaveToDisk({
  jetstreamConn,
  fileName,
  jobId,
  batchId,
  isQuery,
  type,
}: {
  jetstreamConn: ApiConnection;
  fileName: string;
  jobId: string;
  batchId: string;
  isQuery: boolean;
  type: 'request' | 'result';
}): Promise<DownloadFileResult> {
  try {
    // Get download location from user preferences or prompt user
    const downloadPreferences = getUserPreferences().fileDownload;
    let downloadPath: string;

    const safeFileName = toSafeDownloadFileName(fileName);
    if (
      downloadPreferences?.omitPrompt &&
      downloadPreferences?.downloadPath &&
      existsSync(downloadPreferences.downloadPath) &&
      safeFileName
    ) {
      downloadPath = join(downloadPreferences.downloadPath, safeFileName);
    } else {
      const defaultPath = app.getPath('downloads');
      const result = await dialog.showSaveDialog({
        title: 'Save File',
        defaultPath: join(defaultPath, fileName),
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Download canceled by user' };
      }

      downloadPath = result.filePath;
    }

    const results = isQuery
      ? await jetstreamConn.bulk.downloadQueryResults(jobId, batchId)
      : await jetstreamConn.bulk.downloadRecords(jobId, batchId, type);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await writeDownloadToFile(Readable.fromWeb(results as any), downloadPath);

    logger.info(`File downloaded successfully: ${downloadPath}`);
    setRecentDocument(downloadPath);

    return { success: true, filePath: downloadPath };
  } catch (error) {
    logger.error('Error downloading and zipping files', getErrorMessageAndStackObj(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}
