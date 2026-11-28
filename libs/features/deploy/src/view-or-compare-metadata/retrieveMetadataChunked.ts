import { JOB_CANCELED_ERROR_MESSAGE, METADATA_TYPES_WITH_FOLDERS } from '@jetstream/shared/constants';
import { getPackageXml, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { ListMetadataResult, SalesforceOrgUi } from '@jetstream/types';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { FilePropertiesWithContent } from './viewOrCompareMetadataTypes';
import { chunkListMetadataForRetrieve, mergeMetadataXmlFiles, populateFileContents } from './viewOrCompareMetadataUtils';

export interface ChunkedRetrieveProgress {
  completedChunks: number;
  totalChunks: number;
}

export interface ChunkedRetrieveOptions {
  maxComponentsPerChunk?: number;
  isCanceled?: () => boolean;
  onChecked?: () => void;
  onChunkProgress?: (progress: ChunkedRetrieveProgress) => void;
  /**
   * Components added to every chunk on top of the chunk's own. Salesforce only returns the parts of a profile
   * that relate to other components in the same retrieve, so profiles are retrieved alongside those components.
   */
  includeWithEveryChunk?: Record<string, ListMetadataResult[]>;
  /** Only files that pass are returned and have their content read, e.g. to drop the files of `includeWithEveryChunk` */
  includeFile?: (file: FilePropertiesWithContent) => boolean;
  /** Set to false when only `fileProperties` is needed, the merged zip is then left empty */
  buildZip?: boolean;
}

/**
 * Retrieve metadata in chunks sized well below Salesforce's 10,000-file retrieve limit,
 * merging zip files and fileProperties across chunks. Supports cancellation between and during polls.
 */
export async function retrieveMetadataChunked(
  org: SalesforceOrgUi,
  selectedMetadata: Record<string, ListMetadataResult[]>,
  options: ChunkedRetrieveOptions = {},
): Promise<{ zip: JSZip; fileProperties: FilePropertiesWithContent[] }> {
  const { maxComponentsPerChunk, isCanceled, onChecked, onChunkProgress, includeWithEveryChunk, includeFile, buildZip = true } = options;
  const chunks = chunkListMetadataForRetrieve(selectedMetadata, maxComponentsPerChunk);
  const mergedZip = new JSZip();
  const mergedFileProperties: FilePropertiesWithContent[] = [];
  const mergedFilesByName = new Map<string, FilePropertiesWithContent>();

  if (chunks.length === 0) {
    return { zip: mergedZip, fileProperties: mergedFileProperties };
  }

  for (let i = 0; i < chunks.length; i++) {
    if (isCanceled?.()) {
      throw new Error(JOB_CANCELED_ERROR_MESSAGE);
    }
    onChunkProgress?.({ completedChunks: i, totalChunks: chunks.length });

    const { id } = await retrieveMetadataFromListMetadata(
      org,
      includeWithEveryChunk ? { ...includeWithEveryChunk, ...chunks[i] } : chunks[i],
    );
    if (isCanceled?.()) {
      throw new Error(JOB_CANCELED_ERROR_MESSAGE);
    }

    const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
      isCanceled,
      onChecked: () => {
        onChecked?.();
      },
    });

    if (isCanceled?.()) {
      throw new Error(JOB_CANCELED_ERROR_MESSAGE);
    }

    if (!isString(results.zipFile)) {
      throw new Error(results.errorMessage || 'No data was returned from Salesforce');
    }

    const chunkZip = await JSZip.loadAsync(results.zipFile, { base64: true });
    const chunkFiles: FilePropertiesWithContent[] = (results.fileProperties || [])
      .map((file) => {
        // Folders don't have a suffix in the fileProperties response, but there is an associated file, so we must add the extension
        if (METADATA_TYPES_WITH_FOLDERS.has(file.type) && file.fileName.includes('/') && !file.fileName.includes('.')) {
          return { ...file, fileName: `${file.fileName}-meta.xml` };
        }
        return { ...file };
      })
      .filter((file) => !includeFile || includeFile(file));

    await populateFileContents(chunkZip, chunkFiles);

    for (const file of chunkFiles) {
      const existingFile = mergedFilesByName.get(file.fileName);
      if (!existingFile) {
        mergedFilesByName.set(file.fileName, file);
        mergedFileProperties.push(file);
      } else if (file.fileName !== 'package.xml' && existingFile.content && file.content) {
        // The same file comes back from several chunks when its children were split between them
        existingFile.content = mergeMetadataXmlFiles(existingFile.content, file.content) ?? existingFile.content;
      }
    }

    const zipEntries: Array<{ path: string; entry: JSZip.JSZipObject }> = [];
    if (buildZip) {
      chunkZip.forEach((relativePath, entry) => {
        if (!entry.dir) {
          zipEntries.push({ path: relativePath, entry });
        }
      });
    }
    await Promise.all(
      zipEntries.map(async ({ path, entry }) => {
        if (path === 'package.xml' && mergedZip.file('package.xml')) {
          return;
        }
        const existingEntry = mergedZip.file(path);
        if (existingEntry) {
          const mergedXml = mergeMetadataXmlFiles(await existingEntry.async('string'), await entry.async('string'));
          if (mergedXml !== null) {
            mergedZip.file(path, mergedXml);
            return;
          }
        }
        mergedZip.file(path, await entry.async('uint8array'));
      }),
    );

    onChunkProgress?.({ completedChunks: i + 1, totalChunks: chunks.length });
  }

  // When multiple chunks were merged, replace the single-chunk package.xml with a combined manifest
  // so the resulting zip is complete and deployable (e.g. for target org backups).
  if (buildZip && chunks.length > 1 && !isCanceled?.()) {
    try {
      const combinedPackageXml = await getPackageXml(org, selectedMetadata);
      mergedZip.file('package.xml', combinedPackageXml);
    } catch {
      // Keep the first chunk's package.xml if generating a combined manifest fails
    }
  }

  return { zip: mergedZip, fileProperties: mergedFileProperties };
}
