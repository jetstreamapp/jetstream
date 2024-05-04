export interface CharacterInfo {
  textUntilPosition: string;
  mostRecentCharacter: string;
  range: {
    startLineNumber: number;
    endLineNumber: number;
    startColumn: number;
    endColumn: number;
  };
}

export type SpecialWordType =
  | {
      type: 'api' | 'sobject' | 'customLabel' | 'customMetadata' | 'customSettings' | 'customPermission';
      value: string;
    }
  | { type: 'hardCoded'; value: string[] };

export interface ExternalString {
  Name: string;
  MasterLabel: string;
  NamespacePrefix?: string;
  Value: string;
}

export interface CustomPermission {
  DeveloperName: string;
  MasterLabel: string;
  NamespacePrefix?: string;
  Description: string;
}
