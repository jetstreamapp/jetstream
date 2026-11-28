import { logger } from '@jetstream/shared/client-logger';
import { groupByFlat, orderObjectsBy, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ListMetadataResult } from '@jetstream/types';
import { Tooltip, TreeItems } from '@jetstream/ui';
import classNames from 'classnames';
import JSZip from 'jszip';
import { DeployFromCompareMetadataItem, FileItemMetadata, FilePropertiesWithContent } from './viewOrCompareMetadataTypes';
import { compareMetadataContents } from './xmlNormalizer';

/**
 * Salesforce Metadata API retrieve() enforces a hard limit of 10,000 files / 39 MB per request.
 * Many components expand to 2+ files (source + -meta.xml), and bundles (LWC, Aura, Experience)
 * can contain dozens of files per component, so we chunk conservatively well below the ceiling.
 */
export const DEFAULT_RETRIEVE_CHUNK_SIZE = 500;
export const BUNDLE_RETRIEVE_CHUNK_SIZE = 100;

export const MULTI_FILE_BUNDLE_METADATA_TYPES = new Set([
  'AuraDefinitionBundle',
  'ExperienceBundle',
  'LightningComponentBundle',
  'LwcBundle',
  'WaveTemplateBundle',
]);

export function getRetrieveChunkSizeForType(metadataType: string): number {
  return MULTI_FILE_BUNDLE_METADATA_TYPES.has(metadataType) ? BUNDLE_RETRIEVE_CHUNK_SIZE : DEFAULT_RETRIEVE_CHUNK_SIZE;
}

/**
 * Combine two versions of the same metadata XML file that came back from different retrieve chunks.
 * Files such as `objects/Account.object` or `labels/CustomLabels.labels` only contain the children that were
 * requested, so each chunk returns the same path with a different set of children.
 * Returns null when either version cannot be parsed.
 */
export function mergeMetadataXmlFiles(existingXml: string, incomingXml: string): string | null {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return null;
  }
  try {
    const parser = new DOMParser();
    const existingDocument = parser.parseFromString(existingXml, 'application/xml');
    const incomingDocument = parser.parseFromString(incomingXml, 'application/xml');
    const existingRoot = existingDocument.documentElement;
    const incomingRoot = incomingDocument.documentElement;
    const hasParseError = [existingDocument, incomingDocument].some(
      (xmlDocument) => xmlDocument.getElementsByTagName('parsererror').length > 0,
    );
    if (hasParseError || !existingRoot || !incomingRoot || existingRoot.localName !== incomingRoot.localName) {
      return null;
    }
    const serializer = new XMLSerializer();
    const existingChildren = new Set(Array.from(existingRoot.children).map((element) => serializer.serializeToString(element)));
    let addedCount = 0;
    for (const element of Array.from(incomingRoot.children)) {
      if (!existingChildren.has(serializer.serializeToString(element))) {
        existingRoot.appendChild(existingDocument.createTextNode('    '));
        existingRoot.appendChild(existingDocument.importNode(element, true));
        existingRoot.appendChild(existingDocument.createTextNode('\n'));
        addedCount += 1;
      }
    }
    return addedCount === 0 ? existingXml : `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(existingRoot)}`;
  } catch {
    return null;
  }
}

/**
 * Split a `Record<type, ListMetadataResult[]>` payload into retrieve-safe chunks that stay well
 * below Salesforce's 10,000-file retrieve limit. Bundle types get smaller per-chunk limits.
 */
export function chunkListMetadataForRetrieve(
  selectedMetadata: Record<string, ListMetadataResult[]>,
  maxComponentsPerChunk = DEFAULT_RETRIEVE_CHUNK_SIZE,
): Record<string, ListMetadataResult[]>[] {
  const chunks: Record<string, ListMetadataResult[]>[] = [];
  let currentChunk: Record<string, ListMetadataResult[]> = {};
  let currentWeight = 0;

  const flushChunk = () => {
    if (Object.keys(currentChunk).length > 0) {
      chunks.push(currentChunk);
      currentChunk = {};
      currentWeight = 0;
    }
  };

  for (const [metadataType, items] of Object.entries(selectedMetadata)) {
    if (!items?.length) {
      continue;
    }
    const typeLimit = Math.min(maxComponentsPerChunk, getRetrieveChunkSizeForType(metadataType));
    // Bundle components carry higher file weight so mixing them with other types stays safe
    const weightPerItem = MULTI_FILE_BUNDLE_METADATA_TYPES.has(metadataType)
      ? Math.max(1, Math.ceil(maxComponentsPerChunk / typeLimit))
      : 1;

    if (items.length > typeLimit) {
      flushChunk();
      for (const slice of splitArrayToMaxSize(items, typeLimit)) {
        chunks.push({ [metadataType]: slice });
      }
      continue;
    }

    const typeWeight = items.length * weightPerItem;
    if (currentWeight > 0 && currentWeight + typeWeight > maxComponentsPerChunk) {
      flushChunk();
    }

    currentChunk[metadataType] = items;
    currentWeight += typeWeight;
  }

  flushChunk();
  return chunks;
}

export function getEditorLanguage({ fileName, type }: FilePropertiesWithContent) {
  if (type === 'ApexClass' || type === 'ApexTrigger') {
    return 'apex';
  } else if (type === 'ApexPage' || type === 'ApexComponent' || fileName.endsWith('html') || fileName.endsWith('cmp')) {
    return 'html';
  } else if (fileName.endsWith('js')) {
    return 'javascript';
  } else if (fileName.endsWith('css')) {
    return 'css';
  } else if (fileName.endsWith('json')) {
    return 'json';
  }
  return 'xml';
}

/**
 * Attempt to set fileProperties.content on each file
 * @param data
 * @param fileProperties
 */
export async function populateFileContents(data: JSZip, fileProperties: FilePropertiesWithContent[]) {
  await Promise.all(fileProperties.map((item) => getFileContent(data, item)));
}

async function getFileContent(data: JSZip, fileProperties: FilePropertiesWithContent) {
  try {
    if (!data || !fileProperties) {
      return;
    }
    if (!fileProperties.content) {
      fileProperties.content = await data.file(fileProperties.fileName)?.async('string');
    }
  } catch {
    logger.warn('[VIEW OR COMPARE][CONTENT] Could not load content', fileProperties.fileName);
  }
}

/**
 * AMAZING ALGORITHM: https://stackoverflow.com/questions/57344694/create-a-tree-from-a-list-of-strings-containing-paths-of-files-javascript
 * @param sourceResultFiles
 * @param targetResultFiles
 * @returns
 */
export function buildTree(
  sourceResultFiles: FilePropertiesWithContent[] | null,
  targetResultFiles?: FilePropertiesWithContent[] | null,
  options: { normalizePermissionXml?: boolean } = {},
): TreeItems<FileItemMetadata | null>[] {
  const targetFiles = groupByFlat(targetResultFiles || [], 'fileName');

  sourceResultFiles = orderObjectsBy(sourceResultFiles || [], 'fileName');
  targetResultFiles = targetResultFiles ? orderObjectsBy(targetResultFiles || [], 'fileName') : targetResultFiles;

  const result: TreeItems<FileItemMetadata | null>[] = [];
  // level is just a placeholder object to store intermediate results
  const level: any = { result };

  sourceResultFiles
    ?.filter((file) => file.fileName !== 'package.xml')
    .forEach((sourceFile) => {
      sourceFile.fileName.split('/').reduce((output, name, i, arr) => {
        if (!output[name]) {
          output[name] = { result: [] };
          let meta: FileItemMetadata | null = null;
          let id = sourceFile.fileName;
          if (i === arr.length - 1) {
            meta = {
              type: sourceFile.type,
              filename: sourceFile.fileName,
              source: sourceFile,
              target: targetFiles[sourceFile.fileName],
              targetHasLoaded: !!targetResultFiles,
              sourceAndTargetMatch: compare(sourceFile, targetFiles, options),
            };
          } else {
            // set different id for folders
            id = `FOLDER|${id}|${i}|${name}`;
          }
          output.result.push({ id, label: getTreeLabel(id, name, meta), title: name, meta, treeItems: output[name].result });
        }
        return output[name];
      }, level);
    });
  return orderObjectsBy(result, 'label');
}

function getTreeLabel(id: string, name: string, meta: FileItemMetadata | null): string | React.ReactNode {
  if (meta?.source && meta?.targetHasLoaded) {
    let tooltip = 'Source and Target org are the same';
    // The compare result is otherwise text colour + hover tooltip only — carry it in the label text
    // for screen readers without adding a tab stop (WCAG 1.4.1)
    let assistiveStatus = '';
    if (!meta.sourceAndTargetMatch) {
      tooltip = meta?.target?.content ? 'Source and Target org are different' : 'This item does not exist in the target org';
      assistiveStatus = meta?.target?.content ? ' (differs)' : ' (missing in target)';
    }
    return (
      <div className="slds-grid">
        <Tooltip id={`tree-tooltip-compare-${id}`} content={tooltip}>
          <span
            className={classNames({
              'slds-text-color_success': meta.sourceAndTargetMatch,
              'slds-text-color_destructive': !meta.sourceAndTargetMatch,
            })}
          >
            {name}
            {assistiveStatus && <span className="slds-assistive-text">{assistiveStatus}</span>}
          </span>
        </Tooltip>
      </div>
    );
  } else if (meta?.source) {
    return (
      <div className="slds-grid">
        <span>{name}</span>
      </div>
    );
  }
  return name;
}

export function compare(
  sourceFile: FilePropertiesWithContent,
  targetFiles: Record<string, FilePropertiesWithContent>,
  options: { normalizePermissionXml?: boolean } = {},
) {
  const targetFile = targetFiles[sourceFile.fileName];
  if (sourceFile.content == null && targetFile?.content == null) {
    // Preserve legacy behavior when target file exists without readable content, while filterUnchangedFiles guards unreadable items
    return sourceFile.content === targetFile?.content;
  }
  return compareMetadataContents(sourceFile.content, targetFile?.content, {
    metadataType: sourceFile.type,
    fileName: sourceFile.fileName,
    normalizePermissionXml: options.normalizePermissionXml ?? true,
  });
}

/**
 * Remove files that match the target org, along with any folders that are left empty.
 * Node ids and labels are carried over untouched so that the tree's expansion state survives the filter.
 *
 * Anything that could not actually be compared is retained - a file missing from the target org, or a file whose
 * content could not be read out of the retrieve zip, compares as undefined on both sides. Treating that as a match
 * would hide a file that may very well be different.
 */
export function filterUnchangedFiles(files: TreeItems<FileItemMetadata | null>[]): TreeItems<FileItemMetadata | null>[] {
  return files.reduce<TreeItems<FileItemMetadata | null>[]>((output, item) => {
    // Files have metadata, folders do not
    if (item.meta) {
      const { sourceAndTargetMatch, source, target } = item.meta;
      if (!sourceAndTargetMatch || !target || source?.content == null || target.content == null) {
        output.push(item);
      }
      return output;
    }
    const treeItems = filterUnchangedFiles(item.treeItems ?? []);
    if (treeItems.length) {
      output.push({ ...item, treeItems });
    }
    return output;
  }, []);
}

/**
 * Number of files in the tree, folders are not counted
 */
export function countMetadataFiles(files: TreeItems<FileItemMetadata | null>[]): number {
  return files.reduce((count, item) => (item.meta ? count + 1 : count + countMetadataFiles(item.treeItems ?? [])), 0);
}

export function getDeployMetadataFromComparisonTree(files: TreeItems<FileItemMetadata | null>[]): DeployFromCompareMetadataItem[] {
  return files
    .map((metadata) => ({
      type: metadata.treeItems?.[0]?.meta?.type as string,
      items: metadata.treeItems?.map((item) => item.meta)?.filter((meta): meta is FileItemMetadata => meta != null) ?? [],
    }))
    .filter((item) => item.type);
}

export function generateExport(
  sourceResultFiles: FilePropertiesWithContent[],
  targetResultFiles: FilePropertiesWithContent[],
  options: { normalizePermissionXml?: boolean } = {},
) {
  const targetFiles = groupByFlat(targetResultFiles || [], 'fileName');
  return orderObjectsBy(sourceResultFiles, 'fullName')
    .filter(({ fileName }) => fileName !== 'package.xml')
    .map((source) => {
      const target = targetFiles[source.fileName];
      return {
        Type: source.type,
        Name: source.fullName,
        'Exists In Target Org': !!target,
        'Content Matches': compare(source, targetFiles, options) ? 'TRUE' : 'FALSE',
        'File Name': source.fileName,
        'Source Created By': source.createdByName,
        'Source Created Date': source.createdDate,
        'Source Last Modified By': source.lastModifiedByName,
        'Source Last Modified Date': source.lastModifiedDate,
        'Target Created By': target?.createdByName,
        'Target Created Date': target?.createdDate,
        'Target Last Modified By': target?.lastModifiedByName,
        'Target Last Modified Date': target?.lastModifiedDate,
      };
    });
}
