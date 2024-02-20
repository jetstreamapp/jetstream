// https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_calls_describesobjects_describesobjectresult.htm
export interface DescribeSObjectResult {
  activateable: boolean;
  actionOverrides?: ActionOverride[] | null;
  childRelationships: ChildRelationship[];
  compactLayoutable: boolean;
  createable: boolean;
  custom: boolean;
  customSetting: boolean;
  deletable: boolean;
  deprecatedAndHidden: boolean;
  feedEnabled: boolean;
  fields: Field[];
  keyPrefix?: string | null;
  label: string;
  labelPlural: string;
  layoutable: boolean;
  listviewable?: boolean | null;
  lookupLayoutable?: boolean | null;
  mergeable: boolean;
  mruEnabled: boolean;
  name: string;
  namedLayoutInfos: NamedLayoutInfo[];
  networkScopeFieldName?: string | null;
  queryable: boolean;
  recordTypeInfos: RecordTypeInfo[];
  replicateable: boolean;
  retrieveable: boolean;
  searchable: boolean;
  searchLayoutable: boolean;
  supportedScopes: ScopeInfo[];
  triggerable: boolean;
  undeletable: boolean;
  updateable: boolean;
  urlDetail?: string | undefined;
  urlEdit?: string | undefined;
  urlNew?: string | undefined;
  urls: Record<string, string>;
}

export interface ActionOverride {
  formFactor: string;
  isAvailableInTouch: boolean;
  name: string;
  pageId: string;
  url?: string | null;
}

export interface ChildRelationship {
  cascadeDelete: boolean;
  childSObject: string;
  deprecatedAndHidden: boolean;
  field: string;
  junctionIdListNames: string[];
  junctionReferenceTo: string[];
  relationshipName?: string | null;
  restrictedDelete: boolean;
}

export interface Field {
  aggregatable: boolean;
  // Not in documentation, but exists in data
  aiPredictionField?: boolean | null;
  // Salesforce documentation is wrong, they show `autonumber` but true data returned is `autoNumber`
  autoNumber: boolean;
  byteLength: number;
  calculated: boolean;
  calculatedFormula?: string | null;
  cascadeDelete: boolean;
  caseSensitive: boolean;
  compoundFieldName?: string | null;
  controllerName?: string | null;
  createable: boolean;
  custom: boolean;
  defaultValue?: string | boolean | null;
  defaultValueFormula?: string | null;
  defaultedOnCreate: boolean;
  dependentPicklist: boolean;
  deprecatedAndHidden: boolean;
  digits?: number | null;
  displayLocationInDecimal?: boolean | null;
  encrypted?: boolean | null;
  externalId: boolean;
  extraTypeInfo?: ExtraTypeInfo | null;
  filterable: boolean;
  filteredLookupInfo?: FilteredLookupInfo | null;
  // Salesforce documentation is wrong, this field does not exist, calculatedFormula is correct
  formula?: string | null;
  // Not in documentation, but exists in data
  formulaTreatNullNumberAsZero?: boolean | null;
  groupable: boolean;
  highScaleNumber?: boolean | null;
  htmlFormatted: boolean;
  idLookup: boolean;
  inlineHelpText?: string | null;
  label: string;
  length: number;
  mask?: string | null;
  maskType?: string | null;
  name: string;
  nameField: boolean;
  namePointing: boolean;
  nillable: boolean;
  permissionable: boolean;
  picklistValues?: PicklistEntry[] | null;
  polymorphicForeignKey: boolean;
  precision?: number | null;
  queryByDistance: boolean;
  referenceTargetField?: string | null;
  referenceTo?: string[] | null;
  relationshipName?: string | null;
  relationshipOrder?: number | null;
  restrictedDelete?: boolean | null;
  restrictedPicklist: boolean;
  scale: number;
  searchPrefilterable: boolean;
  soapType: SOAPType;
  sortable: boolean;
  type: FieldType;
  unique: boolean;
  updateable: boolean;
  writeRequiresMasterRead?: boolean | null;
}

export interface FieldDefinition {
  Id: string;
  QualifiedApiName: string;
  Label: string;
  MasterLabel: string;
  DataType: string;
  ValueTypeId: string;
  ReferenceTo: {
    referenceTo: string[] | null;
  };
  ExtraTypeInfo: string | null;
  PublisherId: string | null;
  RelationshipName: string | null;
  LastModifiedBy: {
    Name: string;
  } | null;
  LastModifiedDate: string | null;
  IsCompound: boolean;
  IsHighScaleNumber: boolean;
  IsHtmlFormatted: boolean;
  IsNameField: boolean;
  IsNillable: boolean;
  IsCalculated: boolean;
  IsApiFilterable: boolean;
  IsApiGroupable: boolean;
  IsApiSortable: boolean;
  IsPolymorphicForeignKey: boolean;
}

export type ExtraTypeInfo =
  | 'imageurl'
  | 'personname'
  | 'plaintextarea'
  | 'richtextarea'
  | 'switchablepersonname'
  | 'externallookup'
  | 'indirectlookup';

export type FieldType =
  | 'string'
  | 'boolean'
  | 'int'
  | 'double'
  | 'date'
  | 'datetime'
  | 'base64'
  | 'id'
  | 'reference'
  | 'currency'
  | 'textarea'
  | 'percent'
  | 'phone'
  | 'url'
  | 'email'
  | 'combobox'
  | 'picklist'
  | 'multipicklist'
  | 'anyType'
  | 'location'
  // the following are not found in official documentation, but still occur when describing an sobject
  | 'time'
  | 'encryptedstring'
  | 'address'
  | 'complexvalue';

export interface FilteredLookupInfo {
  controllingFields: string[];
  dependent: boolean;
  optionalFilter: boolean;
}

export type SOAPType =
  | 'tns:ID'
  | 'xsd:anyType'
  | 'xsd:base64Binary'
  | 'xsd:boolean'
  | 'xsd:date'
  | 'xsd:dateTime'
  | 'xsd:double'
  | 'xsd:int'
  | 'xsd:string'
  // the following are not found in official documentation, but still occur when describing an sobject
  | 'xsd:time'
  | 'urn:address'
  | 'urn:JunctionIdListNames'
  | 'urn:location'
  | 'urn:RecordTypesSupported'
  | 'urn:RelationshipReferenceTo'
  | 'urn:SearchLayoutButtonsDisplayed'
  | 'urn:SearchLayoutFieldsDisplayed';

export interface PicklistEntry {
  active: boolean;
  validFor?: string | null;
  defaultValue: boolean;
  label?: string | null;
  value: string;
}

export interface RecordTypeInfo {
  available: boolean;
  defaultRecordTypeMapping: boolean;
  developerName?: string | null;
  master: boolean;
  name: string;
  recordTypeId: string;
  urls: Record<string, string>;
}

export interface NamedLayoutInfo {
  name: string;
  urls: Record<string, string>;
}

export interface ScopeInfo {
  label: string;
  name: string;
}

// From
// https://developer.salesforce.com/docs/atlas.en-us.api.meta/api/sforce_api_calls_describeglobal_describeglobalresult.htm#!

export interface DescribeGlobalSObjectResult {
  activateable: boolean;
  createable: boolean;
  custom: boolean;
  customSetting: boolean;
  deletable: boolean;
  deprecatedAndHidden: boolean;
  feedEnabled: boolean;
  hasSubtypes: boolean;
  isSubtype: boolean;
  keyPrefix: string | null;
  label: string;
  labelPlural: string;
  layoutable: boolean;
  mergeable: boolean;
  mruEnabled: boolean;
  name: string;
  queryable: boolean;
  replicateable: boolean;
  retrieveable: boolean;
  searchable: boolean;
  triggerable: boolean;
  undeletable: boolean;
  updateable: boolean;
  urls: Record<string, string>;
}

export interface DescribeSObjectOptions {
  type: string;
  ifModifiedSince?: string | undefined;
}

export interface BatchDescribeSObjectOptions {
  types: string[];
  autofetch?: boolean | undefined;
  maxConcurrentRequests?: number | undefined;
}

export interface DescribeGlobalResult {
  encoding: string;
  maxBatchSize: number;
  sobjects: DescribeGlobalSObjectResult[];
}

export type FieldWithExtendedType = Field & { typeLabel: string };
export type DescribeSObjectResultWithExtendedField = Omit<DescribeSObjectResult, 'fields'> & { fields: FieldWithExtendedType[] };
