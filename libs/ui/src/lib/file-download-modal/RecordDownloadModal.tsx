/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, MAX_RECORDS_PER_GROUP, MIME_TYPES } from '@jetstream/shared/constants';
import { describeSObject } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  formatNumber,
  getChildRelationshipForSubquery,
  getFilename,
  isBrowserExtension,
  isCanvasApp,
  isDesktop,
  isEnterKey,
  planLoadMultiObjectTemplate,
  prepareCsvFile,
  prepareExcelFile,
  prepareLoadMultiObjectTemplate,
  saveFile,
  tracker,
} from '@jetstream/shared/ui-utils';
import {
  flattenRecords,
  getErrorMessage,
  getMapOfBaseAndSubqueryRecords,
  getSubqueryParentPath,
  getSubqueryPathDepth,
  getSubqueryRelationshipName,
  orderObjectsBy,
} from '@jetstream/shared/utils';
import {
  ChildRelationship,
  FileExtCsvXLSXJsonGSheet,
  LoadTemplateDownloadOptions,
  Maybe,
  MimeType,
  QueryResultsColumn,
  SalesforceOrgUi,
  SalesforceRecord,
} from '@jetstream/types';
import { Fragment, FunctionComponent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import FileDownloadGoogle from '../file-download-modal/options/FileDownloadGoogle';
import Checkbox from '../form/checkbox/Checkbox';
import { GoogleSelectedProUpgradeButton } from '../form/file-selector/GoogleSelectedProUpgradeButton';
import Input from '../form/input/Input';
import Radio from '../form/radio/Radio';
import RadioGroup from '../form/radio/RadioGroup';
import Modal from '../modal/Modal';
import { PopoverErrorButton } from '../popover/PopoverErrorButton';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import {
  getInitialDownloadFileFormat,
  getWhichRecordsDefaultValue,
  hasSelectableSubset,
  notifyExcelCellsTruncated,
  RADIO_ALL_BROWSER,
  RADIO_ALL_SERVER,
  RADIO_DOWNLOAD_METHOD_BULK_API,
  RADIO_DOWNLOAD_METHOD_STANDARD,
  RADIO_FILTERED,
  RADIO_FORMAT_CSV,
  RADIO_FORMAT_GDRIVE,
  RADIO_FORMAT_JSON,
  RADIO_FORMAT_XLSX,
  RADIO_FORMAT_XLSX_LOAD_TEMPLATE,
  RADIO_SELECTED,
  saveFileFormatToStorage,
} from './download-modal-utils';

/** All formats the modal can produce - the load template format is only offered when `loadTemplateOption` is provided */
export type RecordDownloadFileFormat = FileExtCsvXLSXJsonGSheet | typeof RADIO_FORMAT_XLSX_LOAD_TEMPLATE;

export interface DownloadFromServerOpts {
  fileFormat: RecordDownloadFileFormat;
  fileName: string;
  fields: string[];
  subqueryFields: Record<string, string[]>;
  whichFields: 'all' | 'specified';
  includeSubquery: boolean;
  /**
   * If downloading from server, this will be the first set of records
   * If uploading to gdrive, this will be the records to include or the first set of records depending on the option selected
   */
  recordsToInclude?: any[];
  /** Only applies if fileFormat === 'gdrive', indicates to ignore nextRecords if there are any */
  hasAllRecords: boolean;
  googleFolder?: Maybe<string>;
  includeDeletedRecords: boolean;
  useBulkApi: boolean; // FIXME: made req to see where used
  /** Only set when fileFormat is the load template - the describe results the worker needs to link subquery records */
  loadTemplate?: Maybe<LoadTemplateDownloadOptions>;
}

export interface RecordDownloadModalProps {
  org: SalesforceOrgUi;
  googleIntegrationEnabled: boolean;
  googleShowUpgradeToPro: boolean;
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  downloadModalOpen: boolean;
  columns?: QueryResultsColumn[];
  fields: string[];
  subqueryFields?: Record<string, string[]>;
  records: SalesforceRecord[];
  filteredRecords?: SalesforceRecord[];
  selectedRecords?: SalesforceRecord[];
  totalRecordCount?: number;
  includeDeletedRecords?: boolean;
  source: string;
  /**
   * When provided, adds a "Load template (Excel)" format that generates a file in the
   * "Load Records to Multiple Objects" template format for the given object.
   */
  loadTemplateOption?: { sobject: string };
  trackEvent: (key: string, value?: Record<string, any>) => void;
  onModalClose: (canceled?: boolean) => void;
  onDownload?: (fileFormat: RecordDownloadFileFormat, whichFields: 'all' | 'specified', includeSubquery: boolean) => void;
  onDownloadFromServer?: (options: DownloadFromServerOpts) => void;
  children?: React.ReactNode;
}

const PROHIBITED_BULK_APEX_TYPES = new Set(['Address', 'Location', 'complexvaluetype']);
const FILE_FORMAT_ALLOWED_BULK_API = new Set<RecordDownloadFileFormat>(['csv', 'gdrive']);
const ALLOW_BULK_API_COUNT = 5_000;
/**
 * A standard download is built entirely in the browser as a single string, so it fails with
 * `RangeError: Invalid string length` once the generated file crosses the ~512MB max string length.
 * XLSX reaches that ceiling first - its XML runs 2-3x the size of the equivalent CSV.
 */
const REQUIRE_BULK_API_COUNT = 500_000;

const LS_KEY = 'RecordDownloadModal';
const allowedTypes: FileExtCsvXLSXJsonGSheet[] = [RADIO_FORMAT_XLSX, RADIO_FORMAT_CSV, RADIO_FORMAT_JSON, RADIO_FORMAT_GDRIVE];

/**
 * Child relationships come from the parent object describe. The status is tracked explicitly because an empty
 * list means something different in each state - "not needed", "still fetching", "the org has none matching",
 * and "the describe failed" all have to read differently to the user.
 */
interface ChildRelationshipsState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  data: ChildRelationship[];
  /** Child relationships of each subquery's own child object, keyed by relationship path - only needed for nested subqueries */
  byPath: Record<string, ChildRelationship[]>;
}
const IDLE_CHILD_RELATIONSHIPS: ChildRelationshipsState = { status: 'idle', data: [], byPath: {} };

export const RecordDownloadModal: FunctionComponent<RecordDownloadModalProps> = ({
  org,
  googleIntegrationEnabled,
  googleShowUpgradeToPro,
  google_apiKey,
  google_appId,
  google_clientId,
  downloadModalOpen,
  columns = [],
  fields = [],
  subqueryFields = {},
  records = [],
  filteredRecords,
  selectedRecords,
  totalRecordCount,
  includeDeletedRecords = false,
  source,
  loadTemplateOption,
  trackEvent,
  onModalClose,
  onDownload,
  onDownloadFromServer,
  children,
}) => {
  const hasGoogleInputConfigured =
    (isDesktop() ||
      isBrowserExtension() ||
      isCanvasApp() ||
      (googleIntegrationEnabled && !!google_apiKey && !!google_appId && !!google_clientId)) &&
    !!onDownloadFromServer;
  const [hasMoreRecords, setHasMoreRecords] = useState<boolean>(false);
  const [downloadRecordsValue, setDownloadRecordsValue] = useState<string>(() =>
    getWhichRecordsDefaultValue({ hasMoreRecords: false, records, selectedRecords }),
  );
  const [fileFormat, setFileFormat] = useState<RecordDownloadFileFormat>(() => getInitialDownloadFileFormat(allowedTypes, LS_KEY));
  const [downloadMethod, setDownloadMethod] = useState<typeof RADIO_DOWNLOAD_METHOD_STANDARD | typeof RADIO_DOWNLOAD_METHOD_BULK_API>(
    RADIO_DOWNLOAD_METHOD_STANDARD,
  );
  const [includeSubquery, setIncludeSubquery] = useState(true);
  const [fileName, setFileName] = useState<string>(getFilename(org, ['records']));
  // If the user changes the filename, we do not want to focus/select the text again or else the user cannot type
  const [doFocusInput, setDoFocusInput] = useState<boolean>(true);
  const inputEl = useRef<HTMLInputElement>(null);

  const [isSignedInWithGoogle, setIsSignedInWithGoogle] = useState<boolean>(false);
  const [googleFolder, setGoogleFolder] = useState<Maybe<string>>(null);

  const [whichFields, setWhichFields] = useState<'all' | 'specified'>('specified');

  const [invalidConfig, setInvalidConfig] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isGooglePickerVisible, setIsGooglePickerVisible] = useState(false);

  const [childRelationships, setChildRelationships] = useState<ChildRelationshipsState>(IDLE_CHILD_RELATIONSHIPS);
  const isLoadingChildRelationships = childRelationships.status === 'loading';

  const hasSubqueriesInQuery = !!subqueryFields && !!Object.keys(subqueryFields).length;
  const hasSubqueryFields = hasSubqueriesInQuery && (fileFormat === 'xlsx' || fileFormat === 'gdrive');

  const isLoadTemplate = fileFormat === RADIO_FORMAT_XLSX_LOAD_TEMPLATE;
  // The load template format is a regular .xlsx file - the format value is only distinct for option selection
  const fileExtension = isLoadTemplate ? RADIO_FORMAT_XLSX : fileFormat;

  const activeRecords = useMemo(() => {
    if (downloadRecordsValue === RADIO_FILTERED) {
      return filteredRecords || [];
    }
    if (downloadRecordsValue === RADIO_SELECTED) {
      return selectedRecords || [];
    }
    return records;
  }, [downloadRecordsValue, filteredRecords, selectedRecords, records]);

  /**
   * Exactly what the generated template will contain, derived by the same function that builds it, so the
   * guidance shown here can never drift from the file the user downloads.
   */
  const templatePlan = useMemo(
    () =>
      planLoadMultiObjectTemplate({
        sobject: loadTemplateOption?.sobject || '',
        fields,
        records: isLoadTemplate ? activeRecords : [],
        // Subqueries only become worksheets when the user opted in and the parent describe resolved the linking field
        subqueryFields: isLoadTemplate && includeSubquery ? subqueryFields : {},
        childRelationships: childRelationships.data,
        childRelationshipsByPath: childRelationships.byPath,
      }),
    [
      isLoadTemplate,
      includeSubquery,
      loadTemplateOption?.sobject,
      fields,
      activeRecords,
      subqueryFields,
      childRelationships.data,
      childRelationships.byPath,
    ],
  );

  const includeSubqueriesInTemplate = isLoadTemplate && !!templatePlan.linked.length;

  /**
   * Downloading all records pages the rest in from Salesforce after the modal closes, so the plan can only be
   * sized from the records already here - which worksheets are created is unaffected, but the group size is a floor.
   */
  const isTemplatePlanFromSample = isLoadTemplate && downloadRecordsValue === RADIO_ALL_SERVER;

  // Big objects report -1 as totalSize
  const totalRecordCountText =
    (totalRecordCount || records.length) < 0
      ? `more than ${formatNumber(records.length)}`
      : formatNumber(totalRecordCount || records.length);

  const allowBulkApi =
    (totalRecordCount || 0) >= ALLOW_BULK_API_COUNT &&
    !Object.keys(subqueryFields).length &&
    records?.[0]?.attributes?.type !== 'AggregateResult' &&
    !columns.some((column) => PROHIBITED_BULK_APEX_TYPES.has(column.apexType || '')) &&
    downloadRecordsValue === RADIO_ALL_SERVER;

  const allowBulkApiWithWarning =
    !allowBulkApi &&
    (totalRecordCount || 0) >= ALLOW_BULK_API_COUNT &&
    records?.[0]?.attributes?.type !== 'AggregateResult' &&
    downloadRecordsValue === RADIO_ALL_SERVER;

  /**
   * Past this volume the browser cannot build the file at all, which is true of the lossless case as much as
   * the lossy one - so both are forced onto the Bulk API rather than only `allowBulkApiWithWarning`.
   */
  const requireBulkApi = (allowBulkApi || allowBulkApiWithWarning) && (totalRecordCount || 0) >= REQUIRE_BULK_API_COUNT;
  const isBulkApi = downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API;

  useEffect(() => {
    if (requireBulkApi) {
      setFileFormat(RADIO_FORMAT_CSV);
      setDownloadMethod(RADIO_DOWNLOAD_METHOD_BULK_API);
    }
  }, [requireBulkApi, downloadRecordsValue]);

  useEffect(() => {
    if (isBulkApi) {
      setFileFormat((prevValue) => (FILE_FORMAT_ALLOWED_BULK_API.has(prevValue) ? prevValue : RADIO_FORMAT_CSV));
    }
  }, [isBulkApi]);

  /**
   * Subqueries that have something nested beneath them, so their own child object has to be described to
   * resolve the nested lookup field. Keyed on the sorted path list rather than the `subqueryFields` object,
   * which callers commonly recreate on every render.
   */
  const subqueryPathsKey = Object.keys(subqueryFields).sort().join('|');
  const nestedParentPaths = useMemo(
    () =>
      orderObjectsBy(
        Array.from(new Set(Object.keys(subqueryFields).map(getSubqueryParentPath).filter(Boolean))).map((relationshipPath) => ({
          relationshipPath,
          depth: getSubqueryPathDepth(relationshipPath),
        })),
        'depth',
      ).map(({ relationshipPath }) => relationshipPath),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subqueryPathsKey],
  );

  // Subquery records can only be linked to their parent in the template if we know the lookup field on the child object
  useEffect(() => {
    const sobject = loadTemplateOption?.sobject;
    if (!downloadModalOpen || !isLoadTemplate || !hasSubqueriesInQuery || !sobject) {
      // React always runs this body after the previous effect's cleanup, so resetting here is what recovers the
      // state when a fetch is abandoned mid-flight (e.g. the user picks a different format while it is running)
      setChildRelationships(IDLE_CHILD_RELATIONSHIPS);
      return;
    }
    let isCanceled = false;
    setChildRelationships({ status: 'loading', data: [], byPath: {} });
    (async () => {
      const { data } = await describeSObject(org, sobject);
      const rootRelationships = data.childRelationships || [];
      const byPath: Record<string, ChildRelationship[]> = {};

      for (const relationshipPath of nestedParentPaths) {
        const grandParentPath = getSubqueryParentPath(relationshipPath);
        const parentRelationships = grandParentPath ? byPath[grandParentPath] : rootRelationships;
        const relationship =
          parentRelationships && getChildRelationshipForSubquery(parentRelationships, getSubqueryRelationshipName(relationshipPath));
        if (!relationship) {
          continue;
        }
        try {
          const childDescribe = await describeSObject(org, relationship.childSObject);
          if (isCanceled) {
            return;
          }
          byPath[relationshipPath] = childDescribe.data.childRelationships || [];
        } catch (ex) {
          // The root describe succeeded, so the top level subqueries can still be linked - only this nested
          // one is unavailable, and it is reported as skipped like any other unresolvable relationship
          logger.warn('[DOWNLOAD] Unable to describe nested object for load template', relationshipPath, ex);
        }
      }

      if (!isCanceled) {
        setChildRelationships({ status: 'loaded', data: rootRelationships, byPath });
      }
    })().catch((ex) => {
      // Without the relationships the parent records can still be downloaded, so this is surfaced as a notice instead of an error
      logger.warn('[DOWNLOAD] Unable to load child relationships for load template', ex);
      if (!isCanceled) {
        setChildRelationships({ status: 'error', data: [], byPath: {} });
      }
    });
    return () => {
      isCanceled = true;
    };
  }, [downloadModalOpen, isLoadTemplate, hasSubqueriesInQuery, loadTemplateOption?.sobject, org, nestedParentPaths]);

  useEffect(() => {
    if (!fileName || (fileFormat === 'gdrive' && !isSignedInWithGoogle)) {
      setInvalidConfig(true);
    } else {
      setInvalidConfig(false);
    }
  }, [fileName, fileFormat, googleFolder, isSignedInWithGoogle]);

  function getDefaultFileName() {
    if (records.length > 0 && records[0].attributes && records[0].attributes.type) {
      return getFilename(org, ['records', records[0].attributes.type]);
    }
    return getFilename(org, ['records']);
  }

  useEffect(() => {
    if (downloadModalOpen) {
      setDoFocusInput(true);
      setFileName(getDefaultFileName());
    } else {
      setDownloadRecordsValue(getWhichRecordsDefaultValue({ hasMoreRecords, records, selectedRecords }));
      setFileFormat(getInitialDownloadFileFormat(allowedTypes, LS_KEY));
      setIncludeSubquery(true);
    }
  }, [downloadModalOpen, hasMoreRecords, org, records, selectedRecords]);

  useEffect(() => {
    if (doFocusInput && fileName && downloadModalOpen && inputEl.current) {
      inputEl.current.focus();
      inputEl.current.select();
      setDoFocusInput(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName]);

  useEffect(() => {
    const hasMoreRecordsTemp = !!totalRecordCount && !!records && (totalRecordCount < 0 || totalRecordCount > records.length);
    setHasMoreRecords(hasMoreRecordsTemp);
    setDownloadRecordsValue(getWhichRecordsDefaultValue({ hasMoreRecords: hasMoreRecordsTemp, records, selectedRecords }));
  }, [totalRecordCount, records, selectedRecords]);

  function handleFileFormatChange(value: string) {
    const newFileFormat = value as RecordDownloadFileFormat;
    // Entering/leaving the load template format swaps the default filename to match the output
    if (newFileFormat === RADIO_FORMAT_XLSX_LOAD_TEMPLATE && loadTemplateOption) {
      setFileName(`${loadTemplateOption.sobject}-load-template`);
    } else if (fileFormat === RADIO_FORMAT_XLSX_LOAD_TEMPLATE && newFileFormat !== RADIO_FORMAT_XLSX_LOAD_TEMPLATE) {
      setFileName(getDefaultFileName());
    }
    setFileFormat(newFileFormat);
  }

  function handleModalClose(canceled?: boolean) {
    onModalClose(canceled);
    if (whichFields !== 'specified') {
      setWhichFields('specified');
    }
  }

  async function handleDownload() {
    errorMessage && setErrorMessage(null);
    let fieldsToUse = fields;
    if (fieldsToUse.length === 0) {
      return;
    }

    // `hasSubqueryFields` only covers the formats that emit a worksheet per subquery - the load template has its
    // own opt-in, and without it the query sent to the server would have its subqueries stripped out
    let _includeSubquery = includeSubquery && (hasSubqueryFields || includeSubqueriesInTemplate);

    // Remove invalid fields from query if necessary for bulk query
    if (downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API && allowBulkApiWithWarning) {
      const complexFields = new Set(
        columns.filter((column) => PROHIBITED_BULK_APEX_TYPES.has(column.apexType || '')).map(({ columnFullPath }) => columnFullPath),
      );
      fieldsToUse = fieldsToUse.filter((field) => !subqueryFields[field] && !complexFields.has(field));
      _includeSubquery = false;
    }

    try {
      const fileNameWithExt = `${fileName}${fileFormat !== 'gdrive' ? `.${fileExtension}` : ''}`;

      /** Google will always load in the background to account for upload to Google */
      if (fileFormat === 'gdrive' || downloadRecordsValue === RADIO_ALL_SERVER) {
        // emit event, which starts job, which downloads in the background
        if (onDownloadFromServer) {
          onDownloadFromServer({
            fileFormat,
            fileName: fileNameWithExt,
            fields: fieldsToUse,
            subqueryFields,
            whichFields,
            includeSubquery: _includeSubquery,
            recordsToInclude: activeRecords,
            hasAllRecords: downloadRecordsValue !== RADIO_ALL_SERVER,
            googleFolder,
            includeDeletedRecords,
            useBulkApi: downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API,
            // The worker cannot describe the object itself, so hand it the relationships already resolved here
            loadTemplate: isLoadTemplate
              ? {
                  sobject: loadTemplateOption?.sobject || '',
                  childRelationships: includeSubqueriesInTemplate ? childRelationships.data : [],
                  childRelationshipsByPath: includeSubqueriesInTemplate ? childRelationships.byPath : {},
                }
              : null,
          });
        }
        handleModalClose();
      } else {
        let mimeType: MimeType;
        let fileData;
        switch (fileFormat) {
          case 'xlsx': {
            let data: Record<string, any[]> = {};

            if (includeSubquery && hasSubqueryFields) {
              data = getMapOfBaseAndSubqueryRecords(activeRecords, fields, subqueryFields);
            } else {
              data['records'] = flattenRecords(activeRecords, fields);
            }

            fileData = prepareExcelFile(data, undefined, undefined, { onCellsTruncated: notifyExcelCellsTruncated });
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case RADIO_FORMAT_XLSX_LOAD_TEMPLATE: {
            const data = prepareLoadMultiObjectTemplate({
              sobject: loadTemplateOption?.sobject || '',
              fields: fieldsToUse,
              records: activeRecords,
              subqueryFields,
              // Subqueries are only turned into worksheets when the linking field is known and the user opted in
              childRelationships: includeSubqueriesInTemplate ? childRelationships.data : [],
              childRelationshipsByPath: includeSubqueriesInTemplate ? childRelationships.byPath : {},
            });
            fileData = prepareExcelFile(data, undefined, undefined, { onCellsTruncated: notifyExcelCellsTruncated });
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case 'csv': {
            const data = flattenRecords(activeRecords, fields);
            fileData = prepareCsvFile(data, fields);
            mimeType = MIME_TYPES.CSV;
            break;
          }
          case 'json': {
            fileData = JSON.stringify(activeRecords, null, 2);
            mimeType = MIME_TYPES.JSON;
            break;
          }
          default:
            throw new Error('A valid file type type has not been selected');
        }

        saveFile(fileData, fileNameWithExt, mimeType);

        if (onDownload) {
          onDownload(fileFormat, whichFields, (includeSubquery && hasSubqueryFields) || includeSubqueriesInTemplate);
        }
        handleModalClose();
      }
      // The load template is only offered to callers that provide `loadTemplateOption`, so persisting it would
      // discard a usable preference in favor of one that cannot be restored anywhere else
      if (!isLoadTemplate) {
        saveFileFormatToStorage(fileFormat, LS_KEY);
      }
      trackEvent(ANALYTICS_KEYS.file_download, { source, fileFormat, component: 'RecordDownloadModal' });
    } catch (ex) {
      logger.error('Error downloading file', ex);
      tracker.error('Record download error', ex, {
        fileFormat,
        recordCount: activeRecords.length,
        fieldCount: fieldsToUse.length,
        downloadMethod,
      });
      // Cell values are truncated before writing, but other SheetJS limits (e.g. the 1,048,576-row cap) can still throw.
      if (getErrorMessage(ex).includes('32767')) {
        setErrorMessage(`One or more values exceed Excel's 32,767 character cell limit. Download as CSV or JSON to get full values.`);
      } else if (fileFormat === 'xlsx' || fileFormat === RADIO_FORMAT_XLSX_LOAD_TEMPLATE) {
        setErrorMessage('There was a problem preparing your file download. Try downloading as CSV or JSON.');
      } else {
        setErrorMessage('There was a problem preparing your file download.');
      }
    }
  }

  function hasFilteredRecords(): boolean {
    return hasSelectableSubset(filteredRecords, records);
  }

  function hasSelectedRecords(): boolean {
    return hasSelectableSubset(selectedRecords, records);
  }

  function handleKeyUp(event: KeyboardEvent<HTMLElement>) {
    if (isEnterKey(event) && !invalidConfig && !isLoadingChildRelationships) {
      handleDownload();
    }
  }

  function handleFolderSelected(folderId?: string) {
    setGoogleFolder(folderId);
  }

  return (
    <Fragment>
      {downloadModalOpen && (
        <Modal
          testId="record-download-modal"
          header="Download Records"
          footer={
            <Fragment>
              {errorMessage && (
                <span className="slds-text-align_left d-inline-block">
                  <PopoverErrorButton errors={errorMessage} />
                </span>
              )}
              <button className="slds-button slds-button_neutral" onClick={() => handleModalClose(true)}>
                Cancel
              </button>
              <button
                className="slds-button slds-button_brand"
                onClick={handleDownload}
                disabled={invalidConfig || isLoadingChildRelationships}
              >
                Download
              </button>
            </Fragment>
          }
          overrideZIndex={1001}
          onClose={() => handleModalClose(true)}
        >
          <div>
            {requireBulkApi && (
              <ScopedNotification theme="info">
                Because of the record volume, your download will use the Salesforce Bulk API and is limited to CSV.
              </ScopedNotification>
            )}
            <RadioGroup label="Which Records" required className="slds-m-bottom_small">
              {hasSelectedRecords() && (
                <Radio
                  name="radio-download"
                  label={`Selected records (${formatNumber(selectedRecords?.length || 0)})`}
                  value={RADIO_SELECTED}
                  checked={downloadRecordsValue === RADIO_SELECTED}
                  onChange={setDownloadRecordsValue}
                />
              )}
              {hasFilteredRecords() && (
                <Radio
                  name="radio-download"
                  label={`Filtered records (${formatNumber(filteredRecords?.length || 0)})`}
                  value={RADIO_FILTERED}
                  checked={downloadRecordsValue === RADIO_FILTERED}
                  onChange={setDownloadRecordsValue}
                />
              )}
              {hasMoreRecords && (
                <Fragment>
                  <Radio
                    name="radio-download"
                    label={`All records (${totalRecordCountText})`}
                    value={RADIO_ALL_SERVER}
                    checked={downloadRecordsValue === RADIO_ALL_SERVER}
                    onChange={setDownloadRecordsValue}
                  />
                  <Radio
                    name="radio-download"
                    label={`First set of records (${formatNumber(records.length)})`}
                    value={RADIO_ALL_BROWSER}
                    checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                    onChange={setDownloadRecordsValue}
                  />
                </Fragment>
              )}
              {!hasMoreRecords && (
                <Radio
                  name="radio-download"
                  label={`All records (${formatNumber(totalRecordCount || records.length)})`}
                  value={RADIO_ALL_BROWSER}
                  checked={downloadRecordsValue === RADIO_ALL_BROWSER}
                  onChange={setDownloadRecordsValue}
                />
              )}
            </RadioGroup>
            <RadioGroup label="File Format" required className="slds-m-bottom_small">
              <Radio
                name="radio-download-file-format"
                label="Excel"
                value={RADIO_FORMAT_XLSX}
                checked={fileFormat === RADIO_FORMAT_XLSX}
                onChange={handleFileFormatChange}
                disabled={isBulkApi}
              />
              <Radio
                name="radio-download-file-format"
                label="CSV"
                value={RADIO_FORMAT_CSV}
                checked={fileFormat === RADIO_FORMAT_CSV}
                onChange={handleFileFormatChange}
              />
              <Radio
                name="radio-download-file-format"
                label="JSON"
                value={RADIO_FORMAT_JSON}
                checked={fileFormat === RADIO_FORMAT_JSON}
                onChange={handleFileFormatChange}
                disabled={isBulkApi}
              />
              {loadTemplateOption && (
                <Radio
                  name="radio-download-file-format"
                  label="Load template (Excel)"
                  value={RADIO_FORMAT_XLSX_LOAD_TEMPLATE}
                  checked={fileFormat === RADIO_FORMAT_XLSX_LOAD_TEMPLATE}
                  onChange={handleFileFormatChange}
                  disabled={isBulkApi}
                />
              )}
              {hasGoogleInputConfigured && (
                <Radio
                  name="radio-download-file-format"
                  label="Google Drive"
                  value={RADIO_FORMAT_GDRIVE}
                  checked={fileFormat === RADIO_FORMAT_GDRIVE}
                  onChange={handleFileFormatChange}
                />
              )}
              {!googleIntegrationEnabled && googleShowUpgradeToPro && (
                <GoogleSelectedProUpgradeButton trackEvent={trackEvent} source={source} />
              )}
              {fileFormat === 'gdrive' && (
                <FileDownloadGoogle
                  google_apiKey={google_apiKey}
                  google_appId={google_appId}
                  google_clientId={google_clientId}
                  onFolderSelected={handleFolderSelected}
                  onSignInChanged={setIsSignedInWithGoogle}
                  onSelectorVisible={setIsGooglePickerVisible}
                />
              )}
            </RadioGroup>
            {isLoadTemplate && (
              <ScopedNotification theme="info" className="slds-m-vertical_x-small">
                Creates an Excel file in the{' '}
                <Link
                  to={{ pathname: APP_ROUTES.LOAD_MULTIPLE.ROUTE, search: APP_ROUTES.LOAD_MULTIPLE.SEARCH_PARAM }}
                  target="_blank"
                  className="slds-text-link"
                >
                  {APP_ROUTES.LOAD_MULTIPLE.TITLE}
                </Link>{' '}
                template format. Each record&apos;s Id becomes its Reference Id and the operation is set to Insert. Adjust the operation,
                remove unwanted columns, and wrap lookup column headers in {'{curly braces}'} to link related records in the same file.
                Relationship fields are not included. Use nested subqueries to include related child records in the template.
                {includeSubqueriesInTemplate && ' Each subquery becomes its own worksheet, linked back to the parent record.'}
                {childRelationships.status === 'loaded' &&
                  !!templatePlan.skipped.length &&
                  ` These subqueries are not included because no matching child relationship was found: ${templatePlan.skipped.join(', ')}.`}
                {/* Only a failure when the user asked for subqueries - otherwise they are excluded by choice, not by the failed describe */}
                {includeSubquery &&
                  childRelationships.status === 'error' &&
                  ` Subqueries are not included because the relationships on ${loadTemplateOption?.sobject} could not be loaded from the org.`}
              </ScopedNotification>
            )}
            {isLoadTemplate && !!templatePlan.missingReferenceId.length && (
              <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
                Add <strong>Id</strong> to your query so every record has a Reference Id to link on. Without it the Reference Id column is
                blank and the file cannot be loaded ({templatePlan.missingReferenceId.join(', ')}).
              </ScopedNotification>
            )}
            {includeSubqueriesInTemplate && templatePlan.largestGroupSize > MAX_RECORDS_PER_GROUP && (
              <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
                One record and its related records add up to {isTemplatePlanFromSample && 'at least '}
                {formatNumber(templatePlan.largestGroupSize)} records. Each parent loads together with its related records as one group,
                which is limited to {formatNumber(MAX_RECORDS_PER_GROUP)} records - remove rows from the downloaded file before loading it.
              </ScopedNotification>
            )}
            {(hasSubqueryFields || (isLoadTemplate && hasSubqueriesInQuery)) && (
              <Checkbox
                id="subquery-checkbox"
                className="slds-m-vertical_x-small"
                label={isLoadTemplate ? 'Include subquery records as linked worksheets' : 'Create a worksheet for each subquery'}
                checked={includeSubquery}
                disabled={isLoadTemplate && isLoadingChildRelationships}
                onChange={setIncludeSubquery}
              />
            )}
            {allowBulkApi && (
              <RadioGroup
                label="Download Method"
                required
                className="slds-m-bottom_small"
                labelHelp="The Bulk API handles large record volumes but has limitations in file format and query support."
              >
                <Radio
                  name="radio-download-method"
                  label="Standard"
                  value={RADIO_DOWNLOAD_METHOD_STANDARD}
                  checked={downloadMethod === RADIO_DOWNLOAD_METHOD_STANDARD}
                  onChange={(value: string) => setDownloadMethod(value as typeof RADIO_DOWNLOAD_METHOD_STANDARD)}
                  disabled={requireBulkApi}
                />
                <Radio
                  name="radio-download-method"
                  label="Salesforce Bulk API"
                  value={RADIO_DOWNLOAD_METHOD_BULK_API}
                  checked={downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API}
                  onChange={(value: string) => setDownloadMethod(value as typeof RADIO_DOWNLOAD_METHOD_BULK_API)}
                  disabled={requireBulkApi}
                />
              </RadioGroup>
            )}
            {allowBulkApiWithWarning && (
              <>
                <RadioGroup
                  label="Download Method"
                  required
                  className="slds-m-bottom_small"
                  labelHelp="The Bulk API handles large record volumes but has limitations in file format and query support."
                >
                  <Radio
                    name="radio-download-method"
                    label="Standard"
                    value={RADIO_DOWNLOAD_METHOD_STANDARD}
                    checked={downloadMethod === RADIO_DOWNLOAD_METHOD_STANDARD}
                    onChange={(value: string) => setDownloadMethod(value as typeof RADIO_DOWNLOAD_METHOD_STANDARD)}
                    disabled={requireBulkApi}
                  />
                  <Radio
                    name="radio-download-method"
                    label="Salesforce Bulk API"
                    value={RADIO_DOWNLOAD_METHOD_BULK_API}
                    checked={downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API}
                    onChange={(value: string) => setDownloadMethod(value as typeof RADIO_DOWNLOAD_METHOD_BULK_API)}
                    disabled={requireBulkApi}
                  />
                </RadioGroup>
                {downloadMethod === RADIO_DOWNLOAD_METHOD_BULK_API && (
                  <ScopedNotification theme="warning">
                    Complex fields, including addresses and subqueries, will be automatically removed from your download.
                  </ScopedNotification>
                )}
              </>
            )}
            <Input
              id="download-filename"
              label="Filename"
              isRequired
              rightAddon={fileFormat !== RADIO_FORMAT_GDRIVE ? `.${fileExtension}` : undefined}
              // Without hasError the required message could never render — an empty name only silently disabled Download
              hasError={!fileName}
              errorMessage="This field is required"
              errorMessageId="filename-error"
            >
              <input
                ref={inputEl}
                id="download-filename"
                className="slds-input"
                value={fileName}
                minLength={1}
                maxLength={250}
                onChange={(event) => setFileName(event.target.value)}
                onKeyUp={handleKeyUp}
              />
            </Input>
          </div>
        </Modal>
      )}
      {children}
    </Fragment>
  );
};

export default RecordDownloadModal;
