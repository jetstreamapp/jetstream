import { FileProperties } from '@jetstream/types';

export type OrgType = 'SOURCE' | 'TARGET';
export type EditorType = 'SOURCE' | 'TARGET' | 'DIFF';
export type FilePropertiesWithContent = FileProperties & { content?: string };
export type FileListItem = {
  key: string;
  heading: string;
  meta: FileProperties;
};

export interface FileItemMetadata {
  type: string; // TODO:
  filename: string;
  source: FilePropertiesWithContent;
  target?: FilePropertiesWithContent;
  targetHasLoaded: boolean;
  sourceAndTargetMatch: boolean;
}
