import { logger } from '@jetstream/shared/client-logger';
import { groupByFlat, orderObjectsBy } from '@jetstream/shared/utils';
import { Tooltip, TreeItems } from '@jetstream/ui';
import classNames from 'classnames';
import JSZip from 'jszip';
import { FileItemMetadata, FilePropertiesWithContent } from './viewOrCompareMetadataTypes';

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
  } catch (ex) {
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
  targetResultFiles?: FilePropertiesWithContent[] | null
): TreeItems<FileItemMetadata | null>[] {
  const targetFiles = groupByFlat(targetResultFiles || [], 'fileName');

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
              sourceAndTargetMatch: compare(sourceFile, targetFiles),
            };
          } else {
            // set different id for folders
            id = `FOLDER|${id}|${i}|${name}`;
          }
          output.result.push({ id, label: getTreeLabel(id, name, meta), meta, treeItems: output[name].result });
        }
        return output[name];
      }, level);
    });
  return orderObjectsBy(result, 'id');
}

function getTreeLabel(id: string, name: string, meta: FileItemMetadata | null): string | JSX.Element {
  if (meta?.source && meta?.targetHasLoaded) {
    let tooltip = 'Source and Target org are the same';
    if (!meta.sourceAndTargetMatch) {
      tooltip = meta?.target?.content ? 'Source and Target org are different' : 'This item does not exist in the target org';
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

export function compare(sourceFile: FilePropertiesWithContent, targetFiles: Record<string, FilePropertiesWithContent>) {
  let match = sourceFile.content === targetFiles[sourceFile.fileName]?.content;
  if (!match && sourceFile.content && targetFiles[sourceFile.fileName]?.content) {
    try {
      match = sourceFile.content.trim() === targetFiles[sourceFile.fileName]?.content?.trim();
    } catch (ex) {
      // ignore failure
    }
  }
  return match;
}

export function generateExport(sourceResultFiles: FilePropertiesWithContent[], targetResultFiles: FilePropertiesWithContent[]) {
  const targetFiles = groupByFlat(targetResultFiles || [], 'fileName');
  return orderObjectsBy(sourceResultFiles, 'fullName')
    .filter(({ fileName }) => fileName !== 'package.xml')
    .map((source) => {
      const target = targetFiles[source.fileName];
      return {
        Type: source.type,
        Name: source.fullName,
        'Exists In Target Org': !!target,
        'Content Matches': compare(source, targetFiles) ? 'TRUE' : 'FALSE',
        'File Name': source.fileName,
        'Source Created By': source.createdByName,
        'Source Created Date': source.createdDate,
        'Source Last Modified By': source.createdByName,
        'Source Last Modified Date': source.createdDate,
        'Target Created By': target?.createdByName,
        'Target Created Date': target?.createdDate,
        'Target Last Modified By': target?.createdByName,
        'Target Last Modified Date': target?.createdDate,
      };
    });
}
