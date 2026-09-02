import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordStringFilter } from '@jetstream/shared/utils';
import {
  FieldMapping,
  FieldMappingItem,
  FieldMappingItemCsv,
  FieldMappingItemStatic,
  FieldWithRelatedEntities,
  InsertUpdateUpsertDelete,
  LoadSavedMappingItem,
  Maybe,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  AssistiveStatus,
  ButtonGroupContainer,
  DropDown,
  Grid,
  GridCol,
  Icon,
  NotSeeingRecentMetadataPopover,
  ScopedNotification,
  SearchInput,
  Tooltip,
  useAnnouncer,
} from '@jetstream/ui';
import {
  autoMapFields,
  checkFieldsForMappingError,
  initAdditionalFieldMappingItem,
  initStaticFieldMappingItem,
  isAdditionalMapping,
  loadFieldMappingFromSavedMapping,
  resetFieldMapping,
  useAmplitude,
} from '@jetstream/ui-core';
import classNames from 'classnames';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import LoadRecordsFieldMappingRow from '../components/LoadRecordsFieldMappingRow';
import LoadRecordsFieldMappingStaticRow from '../components/LoadRecordsFieldMappingStaticRow';
import { LoadMappingPopover } from '../components/load-mapping-storage/LoadMappingPopover';
import SaveMappingPopover from '../components/load-mapping-storage/SaveMappingPopover';
import { countFieldMappingErrors, getFieldMappingErrorStatusMessage } from '../utils/continue-blocked-reason';

type DropDownAction = 'CLEAR' | 'RESET' | 'ALL' | 'MAPPED' | 'UNMAPPED';
type Filter = 'ALL' | 'MAPPED' | 'UNMAPPED';

const MAPPING_CLEAR = 'CLEAR';
const MAPPING_RESET = 'RESET';

const FILTER_ALL = 'ALL';
const FILTER_MAPPED = 'MAPPED';
const FILTER_UNMAPPED = 'UNMAPPED';

export interface LoadRecordsFieldMappingProps {
  org: SalesforceOrgUi;
  sobject: string;
  isCustomMetadataObject: boolean;
  fields: FieldWithRelatedEntities[];
  inputHeader: string[];
  fieldMapping: FieldMapping;
  fileData: any[]; // first row will be used to obtain header
  loadType: InsertUpdateUpsertDelete;
  externalId?: Maybe<string>;
  binaryAttachmentBodyField?: Maybe<string>;
  onFieldMappingChange: (fieldMapping: FieldMapping) => void;
  onRefreshFields: () => Promise<void>;
}

export const LoadRecordsFieldMapping = memo<LoadRecordsFieldMappingProps>(
  ({
    org,
    sobject,
    isCustomMetadataObject,
    fields,
    inputHeader,
    fieldMapping: fieldMappingInit,
    fileData,
    loadType,
    externalId,
    binaryAttachmentBodyField,
    onFieldMappingChange,
    onRefreshFields,
  }) => {
    const { trackEvent } = useAmplitude();
    const hasInitialized = useRef(false);
    const [csvFields, setCsvFields] = useState(() => new Set(inputHeader));
    const [objectFields, setObjectFields] = useState(() => new Set(fields.map((field) => field.name)));
    const [visibleHeaders, setVisibleHeaders] = useState(inputHeader);
    const [activeRowIndex, setActiveRowIndex] = useState(0);
    const [activeRow, setActiveRow] = useState<Record<string, any>>(() => fileData[activeRowIndex]);
    // hack to force child re-render when fields are re-mapped
    const [keyPrefix, setKeyPrefix] = useState<number>(() => new Date().getTime());
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>(() => JSON.parse(JSON.stringify(fieldMappingInit)));
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>(FILTER_ALL);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const debouncedSelectedValue = useDebounce(activeRowIndex, 150);

    /**
     * Static rows and additional mappings are derived from the mapping object rather than tracked in their own
     * state arrays, which keeps them correct through clear/reset/load-saved without any extra bookkeeping.
     * Key insertion order is the order the user added them.
     */
    const staticMappingKeys = useMemo(
      () => Object.keys(fieldMapping).filter((mappingKey) => fieldMapping[mappingKey].type === 'STATIC'),
      [fieldMapping],
    );

    const additionalMappingKeysByCsvField = useMemo(
      () =>
        Object.entries(fieldMapping).reduce<Record<string, string[]>>((output, [mappingKey, fieldMappingItem]) => {
          if (isAdditionalMapping(mappingKey, fieldMappingItem)) {
            output[fieldMappingItem.csvField] = output[fieldMappingItem.csvField] || [];
            output[fieldMappingItem.csvField].push(mappingKey);
          }
          return output;
        }, {}),
      [fieldMapping],
    );

    useNonInitialEffect(() => {
      setActiveRow(fileData[debouncedSelectedValue] || fileData[0]);
    }, [debouncedSelectedValue, fileData, trackEvent]);

    useNonInitialEffect(() => {
      setCsvFields(new Set(inputHeader));
      setObjectFields(new Set(fields.map((field) => field.name)));
    }, [fields, inputHeader]);

    useEffect(() => {
      if (hasInitialized.current) {
        onFieldMappingChange(fieldMapping);
      } else {
        hasInitialized.current = true;
      }
    }, [fieldMapping, onFieldMappingChange]);

    /** Determine if we should show a warning message */
    useEffect(() => {
      if (loadType === 'UPSERT' || isCustomMetadataObject) {
        const { labelMapped, developerNameMapped, externalIdMapped } = Object.values(fieldMapping).reduce(
          (output, fieldMappingItem) => {
            if (fieldMappingItem.targetField === 'Label') {
              output.labelMapped = true;
            } else if (fieldMappingItem.targetField === 'DeveloperName') {
              output.developerNameMapped = true;
            } else if (fieldMappingItem.targetField === externalId) {
              output.externalIdMapped = true;
            }
            return output;
          },
          { labelMapped: false, developerNameMapped: false, externalIdMapped: false },
        );

        if (isCustomMetadataObject && (!labelMapped || !developerNameMapped)) {
          setWarningMessage('Custom Metadata Objects must have Label and DeveloperName mapped.');
          return;
        } else if (!isCustomMetadataObject && !externalIdMapped) {
          setWarningMessage(`Upsert requires the ExternalId field ${externalId} to be mapped.`);
          return;
        }
      }
      setWarningMessage(null);
    }, [externalId, fieldMapping, isCustomMetadataObject, loadType]);

    useNonInitialEffect(() => {
      /**
       * The two filters are intentionally asymmetric.
       * Mapped considers a column and its additional mappings as a unit, otherwise a hidden additional row could
       * block the next step with no visible error. Unmapped only looks at the column's own row, since a blank
       * additional row is inert - it is skipped by the load, by saved mappings, and by every next-step check.
       */
      let tempVisibleHeaders = inputHeader;
      if (filter === FILTER_MAPPED) {
        const rowGroup = (header: string) =>
          [fieldMapping[header], ...(additionalMappingKeysByCsvField[header] || []).map((key) => fieldMapping[key])].filter(Boolean);
        tempVisibleHeaders = tempVisibleHeaders.filter((header) => rowGroup(header).some((item) => !!item.targetField));
      } else if (filter === FILTER_UNMAPPED) {
        tempVisibleHeaders = tempVisibleHeaders.filter((header) => !fieldMapping[header]?.targetField);
      }

      if (searchTerm) {
        tempVisibleHeaders = tempVisibleHeaders.filter(multiWordStringFilter(searchTerm));
      }

      setVisibleHeaders(tempVisibleHeaders);
    }, [searchTerm, filter]);

    /**
     * This is purposefully mutating this state data to avoid re-rendering each child which makes the app seem slow
     * Each child handles its own re-render and stores this state there
     * comboboxes are expensive to re-render if there are many on the page
     *
     */
    function handleFieldMappingChange(mappingKey: string, fieldMappingItem: FieldMappingItem) {
      setFieldMapping((fieldMapping) =>
        checkFieldsForMappingError({ ...fieldMapping, [mappingKey]: fieldMappingItem }, loadType, externalId),
      );
    }

    function handleAction(id: DropDownAction) {
      switch (id) {
        case MAPPING_CLEAR:
          setFieldMapping(resetFieldMapping(inputHeader));
          trackEvent(ANALYTICS_KEYS.load_MappingAutomationChanged, { action: id });
          break;
        case MAPPING_RESET:
          autoMapFields(org, inputHeader, fields, binaryAttachmentBodyField, loadType, externalId).then(setFieldMapping);
          setFilter(FILTER_ALL);
          trackEvent(ANALYTICS_KEYS.load_MappingAutomationChanged, { action: id });
          break;
        case FILTER_ALL:
        case FILTER_MAPPED:
        case FILTER_UNMAPPED:
          setFilter(id as Filter);
          trackEvent(ANALYTICS_KEYS.load_MappingFilterChanged, { filter: id });
          break;
        default:
          break;
      }
      setKeyPrefix(new Date().getTime());
    }

    function handleLoadMapping(savedMapping: LoadSavedMappingItem) {
      const newMapping = loadFieldMappingFromSavedMapping(savedMapping, inputHeader, fields, binaryAttachmentBodyField);
      setFieldMapping(newMapping);
      trackEvent(ANALYTICS_KEYS.load_SavedMappingLoaded);
      setKeyPrefix(new Date().getTime());
    }

    function handlePrevNextRowPreview(action: 'PREV' | 'NEXT') {
      if (action === 'PREV') {
        setActiveRowIndex(activeRowIndex - 1);
      } else {
        setActiveRowIndex(activeRowIndex + 1);
      }
      trackEvent(ANALYTICS_KEYS.load_MappingRowPreviewChanged, { action, rowNumber: activeRowIndex });
    }

    async function handleCacheRefresh() {
      try {
        setRefreshLoading(true);
        await onRefreshFields();
      } catch (ex) {
        logger.warn('Error refreshing fields', ex);
      } finally {
        setRefreshLoading(false);
      }
    }

    // Clear-then-set announcer: removing two rows in a row yields identical messages, which a plain
    // live region would announce only once
    const { announce, announcer } = useAnnouncer();
    const ADD_MANUAL_MAPPING_BUTTON_ID = 'field-mapping-add-manual-mapping';

    // A row's error text is only read when that row's control is focused; this live region tells
    // the user the form has errors to resolve whenever the count changes (same count that blocks
    // the next step)
    const errorStatusMessage = useMemo(() => getFieldMappingErrorStatusMessage(countFieldMappingErrors(fieldMapping)), [fieldMapping]);

    function handleAddRow() {
      const { mappingKey, fieldMappingItem } = initStaticFieldMappingItem();
      setFieldMapping((fieldMapping) => ({ ...fieldMapping, [mappingKey]: fieldMappingItem }));
    }

    /**
     * Removing the row unmounts the focused remove button, which drops focus to <body> — Tab
     * happens to continue from the right place in Chrome (the spec's "sequential focus navigation
     * starting point") but that is unreliable cross-browser and silent for screen readers. Move
     * focus to the adjacent row's action control explicitly and announce the removal.
     */
    function handleRemoveRow(mappingKey: string, triggerElement?: HTMLElement) {
      const row = triggerElement?.closest('tr');
      const adjacentRow = (row?.nextElementSibling ?? row?.previousElementSibling) as HTMLElement | null;
      setFieldMapping((fieldMapping) => {
        const clonedMapping = { ...fieldMapping };
        delete clonedMapping[mappingKey];
        return checkFieldsForMappingError(clonedMapping, loadType, externalId);
      });
      // Announced outside the updater (updaters must stay pure — StrictMode double-invokes them);
      // the post-removal count is derivable from the closure value
      announce(`Mapping removed. ${Math.max(Object.keys(fieldMapping).length - 1, 0)} rows remaining.`);
      // After React commits the removal, land on the equivalent control of the neighboring row — or,
      // when the last row was removed, on the Add Manual Mapping button below the table
      window.setTimeout(() => {
        if (adjacentRow?.isConnected) {
          const controls = adjacentRow.querySelectorAll<HTMLElement>('button, a[href], input, [tabindex]');
          (controls[controls.length - 1] ?? adjacentRow).focus();
          return;
        }
        document.getElementById(ADD_MANUAL_MAPPING_BUTTON_ID)?.focus();
      });
    }

    /** Map a file column that is already mapped to an additional Salesforce field */
    function handleAddAdditionalMapping(csvField: string) {
      const { mappingKey, fieldMappingItem } = initAdditionalFieldMappingItem(csvField);
      setFieldMapping((fieldMapping) => ({ ...fieldMapping, [mappingKey]: fieldMappingItem }));
      trackEvent(ANALYTICS_KEYS.load_MappingAdditionalFieldAdded);
    }

    return (
      <Grid
        vertical
        css={css`
          padding-bottom: 8rem;
        `}
      >
        {announcer}
        <AssistiveStatus message={errorStatusMessage} />
        <GridCol>
          {warningMessage && (
            <ScopedNotification theme="warning">
              <strong>{warningMessage}</strong>
            </ScopedNotification>
          )}
          {isCustomMetadataObject && !warningMessage && (
            <ScopedNotification theme="info">
              Custom metadata will always perform an upsert based on the <strong>DeveloperName</strong>.
            </ScopedNotification>
          )}
        </GridCol>
        <GridCol grow>
          <Grid align="spread" className="slds-p-vertical_xx-small">
            <ButtonGroupContainer>
              <SaveMappingPopover sobject={sobject} fieldMapping={fieldMapping} />
              <LoadMappingPopover sobject={sobject} csvFields={csvFields} objectFields={objectFields} onLoadMapping={handleLoadMapping} />
            </ButtonGroupContainer>
            <SearchInput id="field-filter" className="slds-size_1-of-2" placeholder="Filter fields from file" onChange={setSearchTerm} />
            <NotSeeingRecentMetadataPopover
              popoverProps={{ placement: 'top-start' }}
              header="Missing Fields?"
              label="Not seeing all fields?"
              refreshButtonLabel="Reload Fields"
              org={org}
              viewInSalesforceSetup={{
                label: 'View object in Salesforce setup',
                title: 'View object in Salesforce setup',
                link: `/lightning/setup/ObjectManager/${sobject}/Details/view`,
              }}
              loading={refreshLoading}
              disabled={refreshLoading}
              messages={[
                'If there are fields that are not showing up in the list for mapping, make sure the field is not read-only and that your user has access to the field.',
                'If the missing fields were created recently or if permissions were updated recently then you can reload the fields.',
              ]}
              onReload={handleCacheRefresh}
            />
          </Grid>
          <table
            className="slds-table slds-table_cell-buffer slds-table_bordered"
            /* The trailing action column only holds an icon button — shrink it to its content instead
            of letting it absorb the table's slack width. */
            css={css`
              & > thead > tr > th:last-of-type,
              & > tbody > tr > td:last-of-type {
                width: 1%;
                white-space: nowrap;
              }
            `}
          >
            <thead>
              <tr className="slds-line-height_reset">
                <th
                  scope="col"
                  css={css`
                    width: 200px;
                    max-width: 200px;
                  `}
                >
                  <Grid verticalAlign="center">
                    <button
                      className="slds-button slds-button_icon slds-button_icon-small"
                      title="Preview previous row"
                      disabled={activeRowIndex === 0}
                      onClick={() => handlePrevNextRowPreview('PREV')}
                    >
                      <Icon type="utility" icon="left" omitContainer className="slds-button__icon" />
                      <span className="slds-assistive-text">Previous</span>
                    </button>
                    <div className="slds-truncate slds-m-horizontal_x-small" title="Example Data">
                      Example Data
                    </div>
                    <button
                      className="slds-button slds-button_icon slds-button_icon-small"
                      title="Preview next row"
                      disabled={activeRowIndex === fileData.length - 1}
                      onClick={() => handlePrevNextRowPreview('NEXT')}
                    >
                      <Icon type="utility" icon="right" omitContainer className="slds-button__icon" />
                      <span className="slds-assistive-text">Next</span>
                    </button>
                  </Grid>
                </th>
                <th scope="col">
                  <div className="slds-truncate" title="Field from File">
                    Field from File
                  </div>
                </th>
                <th scope="col"></th>
                <th scope="col">
                  <Grid verticalAlign="center">
                    <div className="slds-truncate" title="Salesforce Field">
                      Salesforce Field
                    </div>
                    <DropDown
                      position="right"
                      buttonClassName={classNames('slds-button slds-button_icon slds-button_icon-small slds-m-left_x-small', {
                        'text-color_brand': filter !== FILTER_ALL,
                      })}
                      actionText="Mapping Filter"
                      description="Mapping Filter"
                      leadingIcon={{ type: 'utility', icon: 'filterList' }}
                      items={[
                        { id: FILTER_ALL, value: 'Show All' },
                        { id: FILTER_MAPPED, value: 'Show Mapped' },
                        { id: FILTER_UNMAPPED, value: 'Show Unmapped' },
                      ]}
                      initialSelectedId={filter}
                      onSelected={(id) => handleAction(id as DropDownAction)}
                    />
                  </Grid>
                </th>
                <th scope="col">
                  <DropDown
                    position="right"
                    actionText="Mapping Options"
                    description="Mapping Options"
                    leadingIcon={{ type: 'utility', icon: 'settings' }}
                    items={[
                      { id: MAPPING_CLEAR, icon: { type: 'utility', icon: 'clear', description: 'Clear mapping' }, value: 'Clear Mapping' },
                      {
                        id: MAPPING_RESET,
                        icon: { type: 'utility', icon: 'undo', description: 'Reset mapping to defaults' },
                        value: 'Reset Mapping',
                      },
                    ]}
                    onSelected={(id) => handleAction(id as DropDownAction)}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleHeaders.flatMap((header) => {
                const mappingItem = fieldMapping[header] as FieldMappingItemCsv | undefined;
                if (!mappingItem) {
                  return [];
                }
                return [
                  <LoadRecordsFieldMappingRow
                    key={`${keyPrefix}-${header}`}
                    org={org}
                    isCustomMetadataObject={isCustomMetadataObject}
                    fields={fields}
                    fieldMappingItem={mappingItem}
                    csvField={header}
                    mappingKey={header}
                    csvRowData={activeRow?.[header]}
                    binaryAttachmentBodyField={binaryAttachmentBodyField}
                    isAdditionalMapping={false}
                    onAddAdditionalMapping={() => handleAddAdditionalMapping(header)}
                    onSelectionChanged={handleFieldMappingChange}
                  />,
                  ...(additionalMappingKeysByCsvField[header] || []).map((mappingKey) => (
                    <LoadRecordsFieldMappingRow
                      key={`${keyPrefix}-${mappingKey}`}
                      org={org}
                      isCustomMetadataObject={isCustomMetadataObject}
                      fields={fields}
                      fieldMappingItem={fieldMapping[mappingKey] as FieldMappingItemCsv}
                      csvField={header}
                      mappingKey={mappingKey}
                      csvRowData={activeRow?.[header]}
                      binaryAttachmentBodyField={binaryAttachmentBodyField}
                      isAdditionalMapping
                      onRemoveRow={(event) => handleRemoveRow(mappingKey, event?.currentTarget)}
                      onSelectionChanged={handleFieldMappingChange}
                    />
                  )),
                ];
              })}
              {staticMappingKeys.map((mappingKey) => {
                const mappingItem = fieldMapping[mappingKey] as FieldMappingItemStatic | undefined;
                if (!mappingItem) {
                  return null;
                }
                return (
                  <LoadRecordsFieldMappingStaticRow
                    key={`${keyPrefix}-${mappingKey}`}
                    org={org}
                    fields={fields}
                    fieldMappingItem={mappingItem}
                    isCustomMetadata={isCustomMetadataObject}
                    onSelectionChanged={(value) => handleFieldMappingChange(mappingKey, value)}
                    onRemoveRow={(event) => handleRemoveRow(mappingKey, event?.currentTarget)}
                  />
                );
              })}
            </tbody>
          </table>
          <Tooltip content="Manually set a provided value for all records for fields not included in your file.">
            <button id={ADD_MANUAL_MAPPING_BUTTON_ID} className="slds-button slds-button_neutral slds-m-top_x-small" onClick={handleAddRow}>
              Add Manual Mapping
            </button>
          </Tooltip>
        </GridCol>
      </Grid>
    );
  },
);

export default LoadRecordsFieldMapping;
