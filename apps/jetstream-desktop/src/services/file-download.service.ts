import { DownloadFileResult, DownloadZipProgress } from '@jetstream/desktop/types';
import { ApiConnection, BinaryFileDownload } from '@jetstream/salesforce-api';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { app, dialog, WebContents } from 'electron';
import logger from 'electron-log';
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { link, open, rename, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { getCandidateFilePaths, isDownloadPathClaimed } from '../utils/download-path.utils';
import { registerOpenableFile } from '../utils/openable-file-registry';
import { markDownloadCompleted, toSafeDownloadFileName } from '../utils/utils';
import { getUserPreferences } from './persistence.service';

/** Most file systems (APFS, NTFS, ext4) limit a single file name to 255 bytes or characters */
const MAX_FILE_NAME_BYTES = 255;

interface DownloadTarget {
  filePath: string;
  /** True when the user picked the path in a save dialog, which already confirmed replacing an existing file */
  overwrite: boolean;
}

function emitProgress(sender: Maybe<WebContents>, progress: DownloadZipProgress) {
  // Send progress update to renderer
  sender?.send('download-progress', progress);
}

function isFileExistsError(ex: unknown) {
  return (ex as NodeJS.ErrnoException)?.code === 'EEXIST';
}

/**
 * Create `targetPath` with the contents of `sourcePath`, failing with EEXIST instead of replacing an existing file
 */
async function copyToNewPath(sourcePath: string, targetPath: string) {
  try {
    await link(sourcePath, targetPath);
    return;
  } catch (ex) {
    if (isFileExistsError(ex)) {
      throw ex;
    }
    // Some file systems (e.g. FAT/exFAT drives) do not support hard links - fall back to an exclusive copy
  }
  // Created exclusively (`wx`) before copying, so a failed copy only ever removes a file this download created
  const targetFile = await open(targetPath, 'wx');
  try {
    await pipeline(createReadStream(sourcePath), targetFile.createWriteStream());
  } catch (ex) {
    await rm(targetPath, { force: true }).catch(() => undefined);
    throw ex;
  }
}

/**
 * `<name>.<id>.partial` next to the destination, with the name shortened if needed so the temporary file name
 * stays within the 255 byte limit most file systems have (the destination name itself may already be close to it)
 */
function getTempFilePath(filePath: string) {
  const suffix = `.${randomUUID().slice(0, 8)}.partial`;
  const nameCharacters = Array.from(basename(filePath));
  while (nameCharacters.length > 0 && Buffer.byteLength(`${nameCharacters.join('')}${suffix}`) > MAX_FILE_NAME_BYTES) {
    nameCharacters.pop();
  }
  return join(dirname(filePath), `${nameCharacters.join('')}${suffix}`);
}

/**
 * Move a completed download into place without replacing an existing file, adding " (1)", " (2)", ... to the name
 * like a browser does. Each name is claimed exclusively, so two downloads finishing together never get the same one.
 */
async function moveToAvailablePath(tempFilePath: string, filePath: string): Promise<string> {
  for (const candidatePath of getCandidateFilePaths(filePath)) {
    // claimed by a Chromium download that has not created its file yet
    if (isDownloadPathClaimed(candidatePath)) {
      continue;
    }
    try {
      await copyToNewPath(tempFilePath, candidatePath);
      await rm(tempFilePath, { force: true });
      return candidatePath;
    } catch (ex) {
      if (!isFileExistsError(ex)) {
        throw ex;
      }
    }
  }
  throw new Error(`Unable to find an available file name for ${basename(filePath)}`);
}

/**
 * Write a download to a temporary `.partial` file next to the destination and move it into place once complete,
 * so a file under the real name is always complete - it can't be opened half written, and a failed download only
 * ever removes its own temporary file.
 *
 * @returns the path the file was saved to, which has a number added if the name was taken and `overwrite` is false
 */
async function writeDownloadToFile(source: Readable, { filePath, overwrite }: DownloadTarget): Promise<string> {
  const tempFilePath = getTempFilePath(filePath);
  try {
    await pipeline(source, createWriteStream(tempFilePath));
    if (overwrite) {
      await rename(tempFilePath, filePath);
      return filePath;
    }
    return await moveToAvailablePath(tempFilePath, filePath);
  } catch (ex) {
    await rm(tempFilePath, { force: true }).catch((removeError) => {
      logger.warn('Unable to remove partial download', getErrorMessageAndStackObj(removeError));
    });
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
    let downloadTarget: DownloadTarget;

    const safeZipFileName = toSafeDownloadFileName(zipFileName);
    if (
      downloadPreferences?.omitPrompt &&
      downloadPreferences?.downloadPath &&
      existsSync(downloadPreferences.downloadPath) &&
      safeZipFileName
    ) {
      downloadTarget = { filePath: join(downloadPreferences.downloadPath, safeZipFileName), overwrite: false };
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

      downloadTarget = { filePath: result.filePath, overwrite: true };
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

    const downloadPath = await writeDownloadToFile(nodeStream, downloadTarget);

    logger.info(`Zip file downloaded successfully: ${downloadPath}`);
    markDownloadCompleted(downloadPath);

    // Registered here, where the file is finalised, so the renderer can later ask to open or reveal
    // exactly this file and nothing else (see `openable-file-registry`)
    return { success: true, filePath: registerOpenableFile(downloadPath) };
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
    let downloadTarget: DownloadTarget;

    const safeFileName = toSafeDownloadFileName(fileName);
    if (
      downloadPreferences?.omitPrompt &&
      downloadPreferences?.downloadPath &&
      existsSync(downloadPreferences.downloadPath) &&
      safeFileName
    ) {
      downloadTarget = { filePath: join(downloadPreferences.downloadPath, safeFileName), overwrite: false };
    } else {
      const defaultPath = app.getPath('downloads');
      const result = await dialog.showSaveDialog({
        title: 'Save File',
        defaultPath: join(defaultPath, fileName),
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Download canceled by user' };
      }

      downloadTarget = { filePath: result.filePath, overwrite: true };
    }

    const results = isQuery
      ? await jetstreamConn.bulk.downloadQueryResults(jobId, batchId)
      : await jetstreamConn.bulk.downloadRecords(jobId, batchId, type);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const downloadPath = await writeDownloadToFile(Readable.fromWeb(results as any), downloadTarget);

    logger.info(`File downloaded successfully: ${downloadPath}`);
    markDownloadCompleted(downloadPath);

    return { success: true, filePath: registerOpenableFile(downloadPath) };
  } catch (error) {
    logger.error('Error downloading and zipping files', getErrorMessageAndStackObj(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}
