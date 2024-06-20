import type { ReactNode } from 'react';
import type * as XLSX from 'xlsx';
import { DeployOptions, DeployResult, DeployResultStatus, ListMetadataResult } from '../salesforce/metadata.types';
import { ChildRelationship, DescribeSObjectResult, Field } from '../salesforce/sobject.types';
import { HttpMethod, Maybe, QueryResultsColumn, SalesforceOrgUi } from '../types';

export type DropDownItemLength = 5 | 7 | 10;

// generic useReducer actions/state for a basic fetch reducer function
export type UseReducerFetchAction<T> =
  | { type: 'REQUEST'; payload?: T }
  | { type: 'SUCCESS'; payload: T }
  | { type: 'ERROR'; payload?: { errorMessage: string; data?: T | null } };

export interface UseReducerFetchState<T> {
  hasLoaded: boolean;
  loading: boolean;
  hasError: boolean;
  errorMessage?: Maybe<string>;
  data: Maybe<T>;
}

export type FileExtCsv = 'csv';
export type FileExtXLSX = 'xlsx';
export type FileExtJson = 'json';
export type FileExtXml = 'xml';
export type FileExtZip = 'zip';
export type FileExtGDrive = 'gdrive';
export type FileExtCsvXLSX = FileExtCsv | FileExtXLSX;
export type FileExtCsvXLSXJson = FileExtCsvXLSX | FileExtJson;
export type FileExtCsvXLSXJsonGSheet = FileExtCsvXLSXJson | FileExtGDrive;
export type FileExtAllTypes = FileExtCsv | FileExtXLSX | FileExtJson | FileExtXml | FileExtZip | FileExtGDrive;

export type Edit = 'edit';
export type Clone = 'clone';
export type Create = 'create';
export type View = 'view';
export type CloneEditView = Edit | Clone | Create | View;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WorkerMessage<T, K = any, E = any> {
  name: T;
  data: K;
  error?: E;
}

export interface QueryFieldWithPolymorphic {
  field: string;
  polymorphicObj: Maybe<string>;
  metadata: Field;
}

export interface QueryFields {
  // this is also the path that will be appended to each field
  // this should end in a "." for related objects
  key: string;
  expanded: boolean;
  loading: boolean;
  hasError: boolean;
  filterTerm: string;
  sobject: string;
  isPolymorphic: boolean;
  fields: Record<string, FieldWrapper>;
  childRelationships?: ChildRelationship[];
  visibleFields: Set<string>;
  selectedFields: Set<string>;
  metadata?: DescribeSObjectResult;
}

export interface FieldWrapper {
  name: string; // this is also the field key
  label: string;
  type: string;
  sobject: string;
  relatedSobject?: string | string[];
  // text used to filter data
  filterText: string;
  metadata: Field;
  // key of related object within QueryFieldMap - only populated for relationship fields and key will only exist once expanded and fetched
  relationshipKey?: string;
}

// Tabs / Accordion / etc..
export interface UiSection {
  id: string;
  testId?: Maybe<string>;
  title: string | ReactNode;
  titleSummaryIfCollapsed?: Maybe<string | ReactNode>; // extra title content to show if collapsed
  titleText?: Maybe<string>; // use if title is not a string
  // eslint-disable-next-line @typescript-eslint/ban-types
  content: React.ReactNode | Function; // => React.ReactNode
  disabled?: Maybe<boolean>;
  className?: Maybe<string>;
  style?: Maybe<React.CSSProperties>;
}

export interface UiTabSection {
  id: string;
  title: React.ReactNode;
  titleText?: string; // use if title is not a string
  titleClassName?: string;
  content: React.ReactNode;
  disabled?: boolean;
}

// Generic size types

export type SizeSmMdLg = SizeSm | SizeMd | SizeLg;
export type SizeSmMdLgXl = SizeSmMdLg | SizeXl;
export type SizeSmMdLgXlFull = SizeSmMdLgXl | SizeFull;
export type SizeSm = 'sm';
export type SizeMd = 'md';
export type SizeLg = 'lg';
export type SizeXl = 'xl';
export type SizeFull = 'full';

export type sizeXXXSmall = 'xxx-small';
export type sizeXXSmall = 'xx-small';
export type sizeXSmall = 'x-small';
export type sizeSmall = 'small';
export type sizeMedium = 'medium';
export type sizeLarge = 'large';
export type sizeXLarge = 'x-large';
export type sizeXXLarge = 'xx-large';

export type SizeXSmallSmallLarge = sizeXSmall | sizeSmall | sizeLarge;
export type SizeXSmallSmallMediumLarge = SizeXSmallSmallLarge | sizeMedium;
export type SizeXXSmallXSmallSmall = sizeXXXSmall | sizeXSmall | sizeSmall;

export type FullWidth = 'full-width';

export type sizeXXXSmallToXXLarge = sizeXXXSmall | sizeXXSmall | sizeXSmall | sizeSmall | sizeMedium | sizeLarge | sizeXLarge | sizeXXLarge;
// 'center' | 'space' | 'spread' | 'end'

export type SmallMediumLarge = sizeSmall | sizeMedium | sizeLarge;
export type SmallMediumLargeFullWidth = SmallMediumLarge | FullWidth;

export type Center = 'center';
export type Space = 'space';
export type Spread = 'spread';
export type Start = 'start';
export type End = 'end';

export type StartCenterEnd = Start | Center | End;
export type CenterSpaceSpreadEnd = Center | Space | Spread | End;

export type Top = 'top';
export type Right = 'right';
export type Bottom = 'bottom';
export type Left = 'left';

export type TopRightBottomLeft = Top | Right | Bottom | Left;
export type RightLeft = Right | Left;

export type Horizontal = 'horizontal';
export type Vertical = 'vertical';

export type HorizontalVertical = Horizontal | Vertical;

// Generic position types
export type PositionLeftRight = PositionLeft | PositionRight;
export type PositionLeftRightTopBottom = PositionLeft | PositionRight | PositionTop | PositionBottom;
export type PositionAll =
  | PositionLeftRight
  | PositionLeftRightTopBottom
  | PositionLeftTop
  | PositionLeftBottom
  | PositionTopLeft
  | PositionTopRight
  | PositionRightTop
  | PositionRightBottom
  | PositionBottomLeft
  | PositionBottomRight;
export type PositionLeft = 'left';
export type PositionLeftTop = 'left-top';
export type PositionLeftBottom = 'left-bottom';
export type PositionTop = 'top';
export type PositionTopLeft = 'top-left';
export type PositionTopRight = 'top-right';
export type PositionRight = 'right';
export type PositionRightTop = 'right-top';
export type PositionRightBottom = 'right-bottom';
export type PositionBottom = 'bottom';
export type PositionBottomLeft = 'bottom-left';
export type PositionBottomRight = 'bottom-right';

export type MimeType =
  | MimeTypePlainText
  | MimeTypeCsv
  | MimeTypeOctetStream
  | MimeTypeOpenOffice
  | MimeTypeZip
  | MimeTypeJson
  | MimeTypeXML
  | MimeTypeGSheet;
export type MimeTypePlainText = 'text/plain;charset=utf-8';
export type MimeTypeCsv = 'text/csv;charset=utf-8';
export type MimeTypeOctetStream = 'application/octet-stream;charset=utf-8';
export type MimeTypeOpenOffice = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export type MimeTypeZip = 'application/zip;charset=utf-8';
export type MimeTypeJson = 'application/json;charset=utf-8';
export type MimeTypeXML = 'text/xml;charset=utf-8';
export type MimeTypeGSheet = 'application/vnd.google-apps.spreadsheet';

export type InputAcceptType = InputAcceptTypeZip | InputAcceptTypeCsv | InputAcceptTypeTsv | InputAcceptTypeExcel | InputAcceptTypeXml;
export type InputAcceptTypeZip = '.zip';
export type InputAcceptTypeCsv = '.csv';
export type InputAcceptTypeTsv = '.tsv';
export type InputAcceptTypeExcel = '.xlsx';
export type InputAcceptTypeXml = '.xml';

// Generic status types
export type Info = 'info';
export type Success = 'success';
export type Warning = 'warning';
export type Error = 'error';
export type Offline = 'offline';

export type Default = 'default';
export type Inverse = 'inverse';
export type Light = 'light';
export type Dark = 'dark';

export type InfoSuccessWarningError = Info | Success | Warning | Error;
export type SuccessWarningError = Success | Warning | Error;
export type InfoWarningErrorOffline = Info | Warning | Error | Offline;
export type DefaultInverseLight = Default | Inverse | Light;
export type BadgeTypes = SuccessWarningError | DefaultInverseLight;
export type ScopedNotificationTypes = Info | Success | Warning | Error | Light | Dark;

export interface ListItemGroup<V = string, M = any> {
  id: string;
  label: string;
  items: ListItem<V, M>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ListItem<V = string, M = any> {
  id: string;
  label: string;
  /** If provided, then this will be used for children ComboboxListItem */
  customRenderer?: (item: ListItem<V, M>) => React.ReactNode;
  secondaryLabel?: string | null;
  secondaryLabelOnNewLine?: boolean | null;
  /** Show a third label under the primary/secondary labels (Combobox) */
  tertiaryLabel?: string;
  disabled?: boolean;
  metaLabel?: string | null;
  /** used for flattened lists (used for virtual scrolling) */
  isGroup?: Maybe<boolean>;
  /** If list is flattened, group information should be attached to each item */
  group?: Maybe<{ id: string; label: string }>;
  /** If true, indicates that this item can be clicked on to drill in to a child menu */
  isDrillInItem?: boolean;
  // Keys of all parent items
  parentId?: string;
  // child items
  childItems?: ListItem<V, M>[];
  value: V;
  title?: string | null;
  meta?: M | null;
}

export type Previous = 'PREVIOUS';
export type Next = 'NEXT';
export type PreviousNext = Previous | Next;

export type Up = 'UP';
export type Down = 'DOWN';
export type UpDown = Up | Down;

export type Select = 'SELECT';
export type SelectMulti = 'SELECT-MULTI';
export type Text = 'TEXT';
export type TextArea = 'TEXTAREA';
export type DateStr = 'DATE';
export type Datetime = 'DATETIME';

export type ExpressionRowValueType = Select | SelectMulti | Text | TextArea | DateStr | Datetime | 'NUMBER' | 'BOOLEAN';

export type AndOr = 'AND' | 'OR';
export type AscDesc = 'ASC' | 'DESC';
export type FirstLast = 'FIRST' | 'LAST';

export interface ExpressionType {
  action: AndOr;
  rows: (ExpressionConditionType | ExpressionGroupType)[];
}

export interface ExpressionConditionType {
  key: number;
  resourceTypes?: ListItem<ExpressionRowValueType>[];
  resourceType?: ExpressionRowValueType;
  resourceSelectItems?: ListItem[];
  selected: ExpressionConditionRowSelectedItems;
  helpText?: ExpressionConditionHelpText;
}

export interface ExpressionGroupType {
  key: number;
  action: AndOr;
  rows: ExpressionConditionType[];
}

export interface ExpressionConditionRowSelectedItems<T = any> {
  resource: string | null;
  resourceMeta?: T;
  resourceGroup: string | null;
  function: string | null;
  operator: QueryFilterOperator | null;
  resourceType?: ExpressionRowValueType;
  value: string | string[];
}

export interface ExpressionConditionHelpText {
  value: string;
  type: 'hint' | 'warning';
}

export interface ExpressionGetResourceTypeFns {
  // used to allow user selection of multiple types - if provided, adds dropdown before value
  getTypes?: (selected: ExpressionConditionRowSelectedItems) => ListItem<ExpressionRowValueType>[] | undefined;
  getType: (selected: ExpressionConditionRowSelectedItems) => ExpressionRowValueType | undefined;
  // used to display optional text below the row
  getHelpText?: (selected: ExpressionConditionRowSelectedItems) => ExpressionConditionHelpText | undefined;
  // optional function to mutate the selected properties (e.x. convert value from/to array from string)
  checkSelected?: (selected: ExpressionConditionRowSelectedItems) => ExpressionConditionRowSelectedItems;
  // used if getType returns select, which shows the user a dropdown
  getSelectItems: (selected: ExpressionConditionRowSelectedItems) => ListItem[] | undefined;
}

export type QueryFilterOperator =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'contains'
  | 'doesNotContain'
  | 'startsWith'
  | 'doesNotStartWith'
  | 'endsWith'
  | 'doesNotEndWith'
  | 'isNull'
  | 'isNotNull'
  | 'in'
  | 'notIn'
  | 'includes'
  | 'excludes';

export interface QueryOrderByClause {
  key: number;
  field: string | null;
  fieldLabel: string | null;
  order: AscDesc;
  nulls: FirstLast | null;
}

export interface QueryGroupByClause {
  key: number;
  field: string | null;
  fieldLabel: string | null;
  function: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DropDownItem<T = any> {
  id: string;
  subheader?: string;
  value: string | ReactNode;
  icon?: {
    type: string;
    icon: string;
    description?: string;
  }; // FIXME: unable to import cross module boundaries
  trailingDivider?: boolean;
  disabled?: boolean;
  title?: string;
  metadata?: T;
}

export interface QueryFieldHeader {
  label: string;
  accessor: string;
  title: string;
  columnMetadata: QueryResultsColumn;
}

export interface FormGroupDropdownItem {
  id: string;
  label: string;
  icon?: any; // FIXME:
}

export type AsyncJobType = 'init' | 'BulkDelete' | 'BulkDownload' | 'RetrievePackageZip' | 'UploadToGoogle' | 'CancelJob';
export type AsyncJobStatus = 'pending' | 'in-progress' | 'success' | 'finished-warning' | 'failed' | 'aborted';

export type AsyncJobNew<T = unknown> = Omit<AsyncJob<T>, 'id' | 'started' | 'finished' | 'lastActivity' | 'status' | 'statusMessage'>;

export interface AsyncJob<T = unknown, R = unknown> {
  id: string;
  type: AsyncJobType;
  title: string;
  org: SalesforceOrgUi;
  started: Date;
  finished: Date;
  lastActivity: Date;
  status: AsyncJobStatus;
  statusMessage?: string; // will fallback to status if not provided
  cancelling?: boolean; // set to true to indicate a cancellation is being attempted
  meta: T;
  results?: R;
}

export interface AsyncJobWorkerMessagePayload<T = unknown> {
  job: AsyncJob<T>;
  org: SalesforceOrgUi;
}

export interface AsyncJobWorkerMessageResponse<T = unknown, R = unknown> {
  job: AsyncJob<T>;
  lastActivityUpdate?: boolean;
  results?: R;
}

export type JetstreamEventType = 'newJob' | 'jobFinished' | 'lastActivityUpdate' | 'addOrg' | 'streamFileDownload';
export type JetstreamEvents =
  | JetstreamEventJobFinished
  | JetstreamEventLastActivityUpdate
  | JetstreamEventNewJob
  | JetstreamEventAddOrg
  | JetstreamEventStreamFile;
export type JetstreamEventPayloads = AsyncJob | AsyncJobNew[] | JetstreamEventAddOrgPayload | JetstreamEventStreamFilePayload;

export interface JetstreamEvent<T> {
  type: JetstreamEventType;
  payload: T;
}

export interface JetstreamEventNewJob extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'newJob';
  payload: AsyncJobNew[];
}

export interface JetstreamEventLastActivityUpdate extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'lastActivityUpdate';
  payload: AsyncJob;
}

export interface JetstreamEventJobFinished extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'jobFinished';
  payload: AsyncJob;
}

export interface JetstreamEventAddOrg extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'addOrg';
  payload: JetstreamEventAddOrgPayload;
}
export interface JetstreamEventAddOrgPayload {
  org: SalesforceOrgUi;
  switchActiveOrg: boolean;
}

export interface JetstreamEventStreamFile extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'streamFileDownload';
  payload: JetstreamEventStreamFilePayload;
}
export interface JetstreamEventStreamFilePayload {
  link: string;
  fileName: string;
}

export interface CancelJob {
  id: string;
}

export interface UploadToGoogleJob {
  fileName: string;
  fileData: any;
  fileType: FileExtCsvXLSX | FileExtZip;
  googleFolder?: Maybe<string>;
}

export interface BulkDownloadJob {
  serverUrl: string;
  sObject: string;
  soql: string;
  isTooling: boolean;
  totalRecordCount: number;
  nextRecordsUrl: Maybe<string>;
  fields: string[];
  subqueryFields: Maybe<Record<string, string[]>>;
  records: Record<string, string>[];
  hasAllRecords: boolean;
  fileFormat: FileExtAllTypes;
  fileName: string;
  googleFolder: Maybe<string>;
  includeSubquery: boolean;
  includeDeletedRecords: boolean;
  useBulkApi: boolean;
}

export interface RetrievePackageJob {
  type: 'listMetadata' | 'packageManifest' | 'packageNames';
  fileName: string;
  fileFormat: FileExtAllTypes;
  mimeType: MimeType;
  uploadToGoogle: boolean;
  googleFolder?: Maybe<string>;
}

export interface RetrievePackageFromListMetadataJob extends RetrievePackageJob {
  type: 'listMetadata';
  listMetadataItems: Record<string, ListMetadataResult[]>;
  fileName: string;
}

export interface RetrievePackageFromManifestJob extends RetrievePackageJob {
  type: 'packageManifest';
  packageManifest: string;
}
export interface RetrievePackageFromPackageNamesJob extends RetrievePackageJob {
  type: 'packageNames';
  packageNames: string[];
}

export interface QueryHistoryItem {
  key: string; // org:object:(lowercase/removespaces(soql))
  org: string;
  sObject: string;
  label: string;
  soql: string;
  created: Date;
  lastRun: Date;
  runCount: number;
  isTooling: boolean;
  isFavorite?: boolean;
}

export interface QueryHistorySelection {
  key: string;
  name: string;
  label: string;
  isTooling: boolean;
}

export interface ApexHistoryItem {
  key: string; // org:object:timestamp
  org: string;
  label: string;
  apex: string;
  lastRun: Date;
}

export interface SalesforceApiHistoryItem {
  key: string; // org:method:url
  org: string;
  label: string;
  request: SalesforceApiHistoryRequest;
  response?: SalesforceApiHistoryResponse;
  lastRun: Date;
}

export type SalesforceDeployHistoryType = 'package' | 'delete' | 'changeset' | 'orgToOrg';

export interface SalesforceDeployHistoryItem {
  key: string; // org:type:timestamp
  fileKey?: string;
  destinationOrg: SalesforceDeploymentHistoryOrg;
  sourceOrg?: SalesforceDeploymentHistoryOrg;
  start: Date;
  finish: Date;
  url?: string | null;
  status: DeployResultStatus;
  type: SalesforceDeployHistoryType;
  errorMessage?: string | null;
  metadata?: Record<string, ListMetadataResult[]>; // TODO: are there other types of metadata?
  deployOptions?: DeployOptions;
  results?: DeployResult;
}

export interface SalesforceDeploymentHistoryOrg {
  uniqueId: string;
  label: string;
  orgName: string;
}

export interface SalesforceApiHistoryRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  bodyType: 'JSON' | 'TEXT';
}

export interface SalesforceApiHistoryResponse {
  status: number;
  statusText: string;
}

export interface InputReadFileContent<T = string | ArrayBuffer> {
  filename: string;
  extension: string;
  content: T;
  isPasteFromClipboard?: boolean;
}

export interface ImageWithUpload extends InputReadFileContent<string> {
  id: string;
  uploading: boolean;
  url?: string;
  error?: string;
  deleteToken?: string;
}

export interface InputReadGoogleSheet {
  workbook: XLSX.WorkBook;
  selectedFile: google.picker.DocumentObject;
}

export interface GoogleFileApiResponse {
  id: string;
  kind: string;
  mimeType: string;
  name: string;
}

export interface SalesforceApiRequest {
  id: string;
  groupName: string;
  groupDescription: string;
  name: string;
  description: string;
  method: HttpMethod;
  url: string;
  header: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApexLog {
  Id: string;
  LogUser: {
    Id: string;
    Name: string;
    Username: string;
  };
  Application: string;
  Operation: string;
  Status: string;
  Location: string;
  LogLength: number;
  Request: string;
  RequestIdentifier: string;
  DurationMilliseconds: number;
  StartTime: string;
  LastModifiedDate: string;
  SystemModstamp: string;
}

export type ApexLogWithViewed = Omit<ApexLog, 'LogLength'> & {
  viewed?: boolean;
  LogLength: string | null;
  'LogUser.Id': string | null;
  'LogUser.Name': string | null;
  'LogUser.Username': string | null;
};

export interface UserTrace {
  Id: string;
  LogType: string;
  TracedEntityId: string;
  StartDate: string;
  ExpirationDate: string;
  DebugLevelId: string;
}

export interface DebugLevel {
  Id: string;
  DeveloperName: string;
  ApexCode: string;
  ApexProfiling: string;
  Callout: string;
  Database: string;
  System: string;
  Validation: string;
  Visualforce: string;
  Wave: string;
  Workflow: string;
}

export interface UseDebugLogsOptions {
  limit?: number;
  pollInterval?: number;
  userId?: string;
}

export interface FetchDebugLogOptions {
  asOfId?: string | null;
  limit?: number | null;
  userId?: string | null;
}

export interface ChangeSet {
  name: string;
  description: string | null;
  link: string;
  status: 'Open' | 'Closed'; // not sure exact types
  modifiedBy: string;
  modifiedDate: string;
}

export type ValidationRule = 'ValidationRule';
export type WorkflowRule = 'WorkflowRule';
export type FlowProcessBuilder = 'FlowProcessBuilder';
export type FlowRecordTriggered = 'FlowRecordTriggered';
export type ApexTrigger = 'ApexTrigger';
export type DuplicateRule = 'DuplicateRule';

export type AutomationMetadataType = DuplicateRule | ValidationRule | WorkflowRule | FlowProcessBuilder | FlowRecordTriggered | ApexTrigger;
