import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordStringFilter } from '@jetstream/shared/utils';
import { InsertUpdateUpsertDelete, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Alert, ButtonGroupContainer, DropDown, Grid, GridCol, Icon, SearchInput } from '@jetstream/ui';
import classNames from 'classnames';
import { memo, useEffect, useRef, useState } from 'react';
import { useAmplitude } from '../../core/analytics';
import LoadRecordsFieldMappingRow from '../components/LoadRecordsFieldMappingRow';
import LoadRecordsRefreshCachePopover from '../components/LoadRecordsRefreshCachePopover';
import { LoadMappingPopover } from '../components/load-mapping-storage/LoadMappingPopover';
import SaveMappingPopover from '../components/load-mapping-storage/SaveMappingPopover';
import { FieldMapping, FieldMappingItem, FieldWithRelatedEntities } from '../load-records-types';
import { LoadSavedMappingItem } from '../load-records.state';
import {
  autoMapFields,
  checkForDuplicateFieldMappings,
  loadFieldMappingFromSavedMapping,
  resetFieldMapping,
} from '../utils/load-records-utils';

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
    const [activeRow, setActiveRow] = useState<string[]>(() => fileData[activeRowIndex]);
    // hack to force child re-render when fields are re-mapped
    const [keyPrefix, setKeyPrefix] = useState<number>(() => new Date().getTime());
    const [fieldMapping, setFieldMapping] = useState<FieldMapping>(() => JSON.parse(JSON.stringify(fieldMappingInit)));
    const [warningMessage, setWarningMessage] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>(FILTER_ALL);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const debouncedSelectedValue = useDebounce(activeRowIndex, 150);

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
          { labelMapped: false, developerNameMapped: false, externalIdMapped: false }
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
    }, [externalId, fieldMapping, loadType]);

    useNonInitialEffect(() => {
      let tempVisibleHeaders = inputHeader;
      if (filter === FILTER_MAPPED) {
        tempVisibleHeaders = tempVisibleHeaders.filter((header) => !!fieldMapping[header]?.targetField);
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
    function handleFieldMappingChange(csvField: string, fieldMappingItem: FieldMappingItem) {
      setFieldMapping((fieldMapping) => checkForDuplicateFieldMappings({ ...fieldMapping, [csvField]: fieldMappingItem }));
    }

    function handleAction(id: DropDownAction) {
      switch (id) {
        case MAPPING_CLEAR:
          setFieldMapping(resetFieldMapping(inputHeader));
          trackEvent(ANALYTICS_KEYS.load_MappingAutomationChanged, { action: id });
          break;
        case MAPPING_RESET:
          setFieldMapping(autoMapFields(inputHeader, fields, binaryAttachmentBodyField));
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
      setFieldMapping(loadFieldMappingFromSavedMapping(savedMapping, inputHeader, fields, binaryAttachmentBodyField));
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

    return (
      <Grid vertical>
        <GridCol>
          {warningMessage && (
            <Alert type="warning" leadingIcon="info">
              <strong>{warningMessage}</strong>
            </Alert>
          )}
          {isCustomMetadataObject && !warningMessage && (
            <Alert type="info" leadingIcon="info">
              Custom metadata will always perform an upsert based on the <strong>DeveloperName</strong>.
            </Alert>
          )}
        </GridCol>
        <GridCol grow>
          <Grid align="spread" className="slds-p-vertical_xx-small">
            <ButtonGroupContainer>
              <SaveMappingPopover sobject={sobject} fieldMapping={fieldMapping} />
              <LoadMappingPopover sobject={sobject} csvFields={csvFields} objectFields={objectFields} onLoadMapping={handleLoadMapping} />
            </ButtonGroupContainer>
            <SearchInput id="field-filter" className="slds-size_1-of-2" placeholder="Filter fields from file" onChange={setSearchTerm} />
            <LoadRecordsRefreshCachePopover org={org} sobject={sobject} loading={refreshLoading} onReload={handleCacheRefresh} />
          </Grid>
          <table className="slds-table slds-table_cell-buffer slds-table_bordered">
            <thead>
              <tr className="slds-line-height_reset">
                <th
                  scope="col"
                  css={css`
                    width: 200px;
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
                      onSelected={handleAction}
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
                    onSelected={handleAction}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleHeaders.map((header, i) => (
                <LoadRecordsFieldMappingRow
                  key={`${keyPrefix}-${i}`}
                  isCustomMetadataObject={isCustomMetadataObject}
                  fields={fields}
                  fieldMappingItem={fieldMapping[header]}
                  csvField={header}
                  csvRowData={activeRow[header]}
                  onSelectionChanged={handleFieldMappingChange}
                />
              ))}
            </tbody>
          </table>
        </GridCol>
      </Grid>
    );
  }
);

export default LoadRecordsFieldMapping;
