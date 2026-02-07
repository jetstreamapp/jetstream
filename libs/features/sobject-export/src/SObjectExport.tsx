import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB, TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useRollbar, useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj, NOOP } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { DescribeGlobalSObjectResult, ListItem, Maybe } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Checkbox,
  ConnectedSobjectListMultiSelect,
  FileDownloadModal,
  Grid,
  Icon,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  Picklist,
  PicklistRef,
  ScopedNotification,
  Spinner,
  Tooltip,
} from '@jetstream/ui';
import { fromJetstreamEvents, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, selectedOrgState } from '@jetstream/ui/app-state';
import { recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtomValue } from 'jotai';
import localforage from 'localforage';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { prepareMetadataExport } from './sobject-export-metadata-utils';
import {
  ExportFormat,
  ExportHeaderOption,
  ExportOptions,
  ExportWorksheetLayout,
  FieldDefinitionRecord,
  SavedExportOptions,
  SobjectExportFieldName,
} from './sobject-export-types';
import {
  FIELD_DEFINITION_API_FIELDS,
  getAttributes,
  getChildRelationshipNames,
  getExtendedFieldDefinitionData,
  getMetadataAttributes,
  getSobjectMetadata,
  prepareExport,
} from './sobject-export-utils';

const HEIGHT_BUFFER = 170;
const FIELD_ATTRIBUTES: ListItem<SobjectExportFieldName>[] = getAttributes().map(({ label, name, description, tertiaryLabel }) => ({
  id: name,
  label: `${label} (${name})`,
  value: name,
  secondaryLabel: description,
  tertiaryLabel,
}));

const METADATA_FIELD_ATTRIBUTES: ListItem<SobjectExportFieldName>[] = getMetadataAttributes().map(
  ({ label, name, description, tertiaryLabel }) => ({
    id: name,
    label: `${label} (${name})`,
    value: name,
    secondaryLabel: description,
    tertiaryLabel,
  }),
);

const DEFAULT_SELECTION: SobjectExportFieldName[] = [
  'calculatedFormula',
  'createable',
  'custom',
  'externalId',
  'formula',
  'label',
  'length',
  'name',
  'nillable',
  'picklistValues',
  'precision',
  'scale',
  'type',
  'unique',
  'updateable',
];

const DEFAULT_METADATA_SELECTION = METADATA_FIELD_ATTRIBUTES.map((item) => item.value);

const DEFAULT_OPTIONS: ExportOptions = {
  exportFormat: 'describe', // describe, metadata
  worksheetLayout: 'combined', // combined, split
  headerOption: 'name', // label, name
  includesStandardFields: true,
  includeObjectAttributes: false,
  saveAsDefaultSelection: false,
};

export interface SObjectExportProps {}

export const SObjectExport: FunctionComponent<SObjectExportProps> = () => {
  useTitle(TITLES.EXPORT_OBJECT_METADATA);
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(selectedOrgState);
  const rollbar = useRollbar();
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);

  const picklistExportFormatRef = useRef<PicklistRef>(null);
  const picklistWorksheetLayoutRef = useRef<PicklistRef>(null);
  const picklistHeaderOptionRef = useRef<PicklistRef>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [sobjects, setSobjects] = useState<Maybe<DescribeGlobalSObjectResult[]>>();
  const [selectedSObjects, setSelectedSObjects] = useState<string[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<SobjectExportFieldName[]>([]);

  const [exportDataModalOpen, setExportDataModalOpen] = useState<boolean>(false);
  const [exportDataModalData, setExportDataModalData] = useState<Record<string, any[]>>({});

  const [hasSelectionsMade, setHasSelectionsMade] = useState(false);
  const [options, setOptions] = useState<ExportOptions>({ ...DEFAULT_OPTIONS });

  const isMetadataExport = options.exportFormat === 'metadata';

  useEffect(() => {
    setSobjects(null);
    setSelectedSObjects([]);
  }, [selectedOrg]);

  useEffect(() => {
    if (isMetadataExport) {
      picklistHeaderOptionRef.current?.selectItem('name');
      picklistWorksheetLayoutRef.current?.selectItem('split');
    }
  }, [isMetadataExport]);

  useEffect(() => {
    (async () => {
      try {
        const results = await localforage.getItem<SavedExportOptions>(INDEXED_DB.KEYS.sobjectExportSelection);
        if (results?.options) {
          setOptions(results.options);
          if (picklistExportFormatRef.current) {
            picklistExportFormatRef.current.selectItem(results.options.exportFormat || 'describe');
          }
          if (picklistWorksheetLayoutRef.current) {
            picklistWorksheetLayoutRef.current.selectItem(results.options.worksheetLayout);
          }
          if (picklistHeaderOptionRef.current) {
            picklistHeaderOptionRef.current.selectItem(results.options.headerOption);
          }
        }
        if (results?.fields) {
          setSelectedAttributes(results.fields as SobjectExportFieldName[]);
        } else {
          setSelectedAttributes([...DEFAULT_SELECTION]);
        }
      } catch (ex) {
        logger.error('Error loading default export selection', ex);
      }
    })();
  }, [picklistExportFormatRef, picklistWorksheetLayoutRef, picklistHeaderOptionRef]);

  useEffect(() => {
    setHasSelectionsMade(!!selectedSObjects?.length && !!selectedAttributes?.length);
  }, [selectedSObjects, selectedAttributes]);

  function handleSobjectChange(sobjects: DescribeGlobalSObjectResult[] | null) {
    setSobjects(sobjects);
  }

  function resetAttributesToDefault() {
    setSelectedAttributes([...DEFAULT_SELECTION]);
  }

  function resetOptionsToDefault() {
    setOptions({ ...DEFAULT_OPTIONS });
    if (picklistExportFormatRef.current) {
      picklistExportFormatRef.current.selectItem(DEFAULT_OPTIONS.exportFormat);
    }
    if (picklistWorksheetLayoutRef.current) {
      picklistWorksheetLayoutRef.current.selectItem(DEFAULT_OPTIONS.worksheetLayout);
    }
    if (picklistHeaderOptionRef.current) {
      picklistHeaderOptionRef.current.selectItem(DEFAULT_OPTIONS.headerOption);
    }
  }

  function handleOptionsChange(optionItem: Partial<ExportOptions>) {
    setOptions({ ...options, ...optionItem });
  }

  async function handleExport() {
    try {
      setLoading(true);
      setErrorMessage(null);

      let output: Record<string, any[]>;

      if (isMetadataExport) {
        // Use metadata export for Create Fields import template format
        output = await prepareMetadataExport(selectedOrg, selectedSObjects, options);
      } else {
        // Use describe export for traditional format
        const metadataResults = await getSobjectMetadata(selectedOrg, selectedSObjects);
        const sobjectsWithChildRelationships = selectedAttributes.includes('childRelationshipName')
          ? await getChildRelationshipNames(selectedOrg, metadataResults)
          : {};

        const extendedFieldDefinitionData: Record<string, Record<string, FieldDefinitionRecord>> = selectedAttributes.some((item) =>
          FIELD_DEFINITION_API_FIELDS.has(item as any),
        )
          ? await getExtendedFieldDefinitionData(selectedOrg, selectedSObjects)
          : {};

        output = prepareExport(metadataResults, sobjectsWithChildRelationships, extendedFieldDefinitionData, selectedAttributes, options);
      }

      if (options.saveAsDefaultSelection) {
        try {
          await localforage.setItem<SavedExportOptions>(INDEXED_DB.KEYS.sobjectExportSelection, {
            fields: selectedAttributes,
            options: { ...options, saveAsDefaultSelection: false },
          });
        } catch (ex) {
          logger.error('Error saving default export selection', ex);
        }
      }

      setExportDataModalData(output);
      setExportDataModalOpen(true);
    } catch (ex) {
      logger.error(ex);
      setErrorMessage(getErrorMessage(ex));
      rollbar.error('Error preparing sobject export', getErrorMessageAndStackObj(ex));
    } finally {
      setLoading(false);
      recentHistoryItemsDb.addItemToRecentHistoryItems(selectedOrg.uniqueId, 'sobject', selectedSObjects);
    }
  }

  return (
    <Fragment>
      {exportDataModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Object Export"
          data={exportDataModalData}
          fileNameParts={['object', 'export']}
          allowedTypes={['xlsx']}
          onModalClose={() => setExportDataModalOpen(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          source="sobject_export"
          trackEvent={trackEvent}
        />
      )}
      <Page testId="sobject-export-page">
        <PageHeader>
          <PageHeaderRow>
            <PageHeaderTitle
              icon={{ type: 'standard', icon: 'product_consumed' }}
              label="Export Object Metadata"
              docsPath={APP_ROUTES.OBJECT_EXPORT.DOCS}
            />
            <PageHeaderActions colType="actions" buttonType="separate">
              <button className="slds-button slds-button_brand" disabled={!hasSelectionsMade || loading} onClick={handleExport}>
                Download
              </button>
            </PageHeaderActions>
          </PageHeaderRow>
          <PageHeaderRow>
            <div
              className="slds-col_bump-left"
              css={css`
                min-height: 19px;
              `}
            >
              {!hasSelectionsMade && <span>Select one or more objects and one or more attributes</span>}
            </div>
          </PageHeaderRow>
        </PageHeader>
        <AutoFullHeightContainer
          bottomBuffer={10}
          className="slds-p-horizontal_x-small slds-scrollable_none"
          bufferIfNotRendered={HEIGHT_BUFFER}
        >
          {loading && <Spinner />}
          <Split
            sizes={[33, 33, 33]}
            minSize={[300, 300, 300]}
            gutterSize={sobjects?.length ? 10 : 0}
            className="slds-gutters"
            css={css`
              display: flex;
              flex-direction: row;
            `}
          >
            <div className="slds-p-horizontal_x-small">
              <ConnectedSobjectListMultiSelect
                selectedOrg={selectedOrg}
                sobjects={sobjects}
                selectedSObjects={selectedSObjects}
                allowSelectAll={false}
                recentItemsEnabled
                recentItemsKey="sobject"
                onSobjects={handleSobjectChange}
                onSelectedSObjects={setSelectedSObjects}
              />
            </div>
            <div className="slds-p-horizontal_x-small">
              <Picklist
                ref={picklistExportFormatRef}
                className="slds-m-top_x-small"
                label="Export Format"
                items={[
                  {
                    id: 'describe',
                    value: 'describe',
                    label: 'Describe Format',
                    secondaryLabel: 'Same format as Query Builder',
                    secondaryLabelOnNewLine: true,
                  },
                  {
                    id: 'metadata',
                    value: 'metadata',
                    label: 'Metadata Format',
                    secondaryLabel: 'Create Fields import template',
                    secondaryLabelOnNewLine: true,
                  },
                ]}
                selectedItemIds={[options.exportFormat]}
                allowDeselection={false}
                disabled={loading}
                onChange={(items) => handleOptionsChange({ exportFormat: items[0].id as ExportFormat })}
              />
              {isMetadataExport && (
                <>
                  <ScopedNotification theme="info" className="slds-m-top_x-small">
                    Metadata format will include all metadata fields and can be used as an import template in the Create Object and Fields
                    feature.
                  </ScopedNotification>
                  <ListWithFilterMultiSelect
                    labels={{
                      listHeading: 'Metadata Attributes',
                      filter: 'Filter Metadata Attributes',
                      descriptorSingular: 'metadata attribute',
                      descriptorPlural: 'metadata attributes',
                    }}
                    disabled
                    items={METADATA_FIELD_ATTRIBUTES as ListItem[]}
                    selectedItems={DEFAULT_METADATA_SELECTION}
                    omitFilter
                    onSelected={NOOP}
                  />
                </>
              )}
              {!isMetadataExport && (
                <ListWithFilterMultiSelect
                  labels={{
                    listHeading: 'Field Attributes',
                    filter: 'Filter Attributes',
                    descriptorSingular: 'field attribute',
                    descriptorPlural: 'field attributes',
                  }}
                  items={FIELD_ATTRIBUTES as ListItem[]}
                  selectedItems={selectedAttributes}
                  allowRefresh
                  lastRefreshed="Reset to default"
                  onRefresh={resetAttributesToDefault}
                  onSelected={(items) => setSelectedAttributes(items as SobjectExportFieldName[])}
                />
              )}
            </div>
            <div className="slds-p-horizontal_x-small">
              <Grid>
                <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">Export Options</h2>
                <div>
                  <Tooltip id={`sobject-list-refresh-tooltip`} content="Reset to default">
                    <button
                      className="slds-button slds-button_icon slds-button_icon-container"
                      disabled={loading}
                      onClick={resetOptionsToDefault}
                    >
                      <Icon type="utility" icon="refresh" description={`Reset to default`} className="slds-button__icon" omitContainer />
                    </button>
                  </Tooltip>
                </div>
              </Grid>

              <div className="slds-p-around--xx-small">
                {loading && <Spinner />}
                {errorMessage && (
                  <div className="slds-m-around-medium">
                    <ScopedNotification theme="error" className="slds-m-top_medium">
                      There was a problem preparing the export:
                      <p>{errorMessage}</p>
                    </ScopedNotification>
                  </div>
                )}
                <Picklist
                  ref={picklistWorksheetLayoutRef}
                  className="slds-m-top_x-small"
                  label="Worksheet Layout"
                  items={[
                    { id: 'combined', value: 'combined', label: 'Include all objects on one worksheet' },
                    { id: 'split', value: 'split', label: 'Split into a worksheet per object' },
                  ]}
                  selectedItemIds={[options.worksheetLayout]}
                  allowDeselection={false}
                  disabled={loading}
                  onChange={(items) => handleOptionsChange({ worksheetLayout: items[0].id as ExportWorksheetLayout })}
                />
                <Picklist
                  ref={picklistHeaderOptionRef}
                  className="slds-m-top_x-small"
                  label="Header Option"
                  items={[
                    { id: 'label', value: 'label', label: 'Use standard label (e.x. AI Prediction Field)' },
                    { id: 'name', value: 'name', label: 'Use camelCase label (e.x. aiPredictionField)' },
                  ]}
                  selectedItemIds={[isMetadataExport ? 'name' : options.headerOption]}
                  allowDeselection={false}
                  disabled={loading || isMetadataExport}
                  onChange={(items) => handleOptionsChange({ headerOption: items[0].id as ExportHeaderOption })}
                />
                <Checkbox
                  id={`includeStandardFields`}
                  className="slds-m-top_x-small"
                  label="Includes standard fields"
                  labelHelp="If selected, standard fields will be included in addition to custom fields."
                  checked={isMetadataExport ? false : options.includesStandardFields}
                  disabled={loading || isMetadataExport}
                  onChange={(value) => handleOptionsChange({ includesStandardFields: value })}
                />
                <Checkbox
                  id={`includeObjectAttributes`}
                  className="slds-m-top_x-small"
                  label="Include object attributes"
                  labelHelp="If selected, a worksheet will be added with object attributes in addition to field attributes"
                  checked={isMetadataExport ? false : options.includeObjectAttributes}
                  disabled={loading || isMetadataExport}
                  onChange={(value) => handleOptionsChange({ includeObjectAttributes: value })}
                />
                <Checkbox
                  id={`saveAsDefaultSelection`}
                  className="slds-m-top_x-small"
                  label="Save selected fields and options as default"
                  labelHelp="Choose this option if you want the default selected fields to be saved for the next time you need to do an export."
                  checked={isMetadataExport ? false : options.saveAsDefaultSelection}
                  disabled={loading || isMetadataExport}
                  onChange={(value) => handleOptionsChange({ saveAsDefaultSelection: value })}
                />
              </div>
            </div>
          </Split>
        </AutoFullHeightContainer>
      </Page>
    </Fragment>
  );
};
