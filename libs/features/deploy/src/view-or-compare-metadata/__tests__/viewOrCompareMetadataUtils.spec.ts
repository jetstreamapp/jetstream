import { FileProperties } from '@jetstream/types';
import { TreeItems } from '@jetstream/ui';
import { FileItemMetadata } from '../viewOrCompareMetadataTypes';
import { countMetadataFiles, filterUnchangedFiles } from '../viewOrCompareMetadataUtils';

function getFileProperties(fileName: string): FileProperties {
  return {
    type: 'ApexClass',
    createdById: '005000000000000',
    createdByName: 'Test User',
    createdDate: '2026-01-01T00:00:00.000Z',
    fileName,
    fullName: fileName.split('/').pop() as string,
    id: '01p000000000000',
    lastModifiedById: '005000000000000',
    lastModifiedByName: 'Test User',
    lastModifiedDate: '2026-01-01T00:00:00.000Z',
  };
}

function getFileNode(
  fileName: string,
  sourceAndTargetMatch: boolean,
  existsInTarget = sourceAndTargetMatch,
): TreeItems<FileItemMetadata | null> {
  const name = fileName.split('/').pop() as string;
  return {
    id: fileName,
    label: name,
    title: name,
    meta: {
      type: 'ApexClass',
      filename: fileName,
      source: { ...getFileProperties(fileName), content: 'source' },
      target: existsInTarget ? { ...getFileProperties(fileName), content: 'source' } : undefined,
      targetHasLoaded: true,
      sourceAndTargetMatch,
    },
    treeItems: [],
  };
}

function getFolderNode(name: string, treeItems: TreeItems<FileItemMetadata | null>[]): TreeItems<FileItemMetadata | null> {
  return { id: `FOLDER|${name}|0|${name}`, label: name, title: name, meta: null, treeItems };
}

describe('filterUnchangedFiles', () => {
  it('removes files that match the target org and keeps the ones that do not', () => {
    const files = [
      getFolderNode('classes', [
        getFileNode('classes/Matching.cls', true),
        getFileNode('classes/Different.cls', false),
        getFileNode('classes/AlsoMatching.cls', true),
      ]),
    ];

    const results = filterUnchangedFiles(files);

    expect(results).toHaveLength(1);
    expect(results[0].treeItems?.map(({ id }) => id)).toEqual(['classes/Different.cls']);
  });

  it('prunes folders that no longer have any files', () => {
    const files = [
      getFolderNode('classes', [getFileNode('classes/Different.cls', false)]),
      getFolderNode('triggers', [getFileNode('triggers/Matching.trigger', true)]),
    ];

    const results = filterUnchangedFiles(files);

    expect(results.map(({ id }) => id)).toEqual(['FOLDER|classes|0|classes']);
  });

  it('keeps nested folders that still have a changed descendant', () => {
    const files = [
      getFolderNode('reports', [
        getFolderNode('MyFolder', [
          getFileNode('reports/MyFolder/Changed.report', false),
          getFileNode('reports/MyFolder/Same.report', true),
        ]),
        getFolderNode('OtherFolder', [getFileNode('reports/OtherFolder/Same.report', true)]),
      ]),
    ];

    const results = filterUnchangedFiles(files);

    expect(results).toHaveLength(1);
    expect(results[0].treeItems?.map(({ id }) => id)).toEqual(['FOLDER|MyFolder|0|MyFolder']);
    expect(results[0].treeItems?.[0].treeItems?.map(({ id }) => id)).toEqual(['reports/MyFolder/Changed.report']);
  });

  it('preserves the id, label and metadata of retained nodes', () => {
    const changedFile = getFileNode('classes/Different.cls', false);
    const folder = getFolderNode('classes', [changedFile, getFileNode('classes/Matching.cls', true)]);

    const [resultFolder] = filterUnchangedFiles([folder]);

    expect(resultFolder.id).toBe(folder.id);
    expect(resultFolder.label).toBe(folder.label);
    expect(resultFolder.treeItems?.[0]).toBe(changedFile);
  });

  it('handles files that are not inside a folder', () => {
    const files = [getFileNode('Different.cls', false), getFileNode('Matching.cls', true)];

    expect(filterUnchangedFiles(files).map(({ id }) => id)).toEqual(['Different.cls']);
  });

  it('keeps files that are missing from the target org even if they compare as matching', () => {
    // Content is undefined when a file could not be read out of the zip, which compares equal to an absent target file
    const files = [getFolderNode('classes', [getFileNode('classes/Missing.cls', true, false), getFileNode('classes/Matching.cls', true)])];

    const results = filterUnchangedFiles(files);

    expect(results[0].treeItems?.map(({ id }) => id)).toEqual(['classes/Missing.cls']);
  });

  it('returns an empty array when every file matches', () => {
    const files = [getFolderNode('classes', [getFileNode('classes/Matching.cls', true)])];

    expect(filterUnchangedFiles(files)).toEqual([]);
  });
});

describe('countMetadataFiles', () => {
  it('counts files and ignores folders at any depth', () => {
    const files = [
      getFolderNode('classes', [getFileNode('classes/One.cls', true), getFileNode('classes/Two.cls', false)]),
      getFolderNode('reports', [getFolderNode('MyFolder', [getFileNode('reports/MyFolder/One.report', false)])]),
      getFileNode('Root.cls', false),
    ];

    expect(countMetadataFiles(files)).toBe(4);
  });

  it('returns zero for an empty tree', () => {
    expect(countMetadataFiles([])).toBe(0);
  });
});
