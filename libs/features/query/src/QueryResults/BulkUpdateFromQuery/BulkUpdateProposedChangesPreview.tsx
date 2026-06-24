import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  DataTable,
  FileDownloadModal,
  Grid,
  Icon,
  RowWithKey,
  setColumnFromType,
} from '@jetstream/ui';
import { fromJetstreamEvents, MetadataRowConfiguration, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useCallback, useMemo, useState } from 'react';
import { formatProposedValue, ProposedChangesResult } from './bulk-update-preview.utils';

interface DownloadModalState {
  open: boolean;
  data: Record<string, unknown>[];
  header: string[];
  fileNameParts: string[];
}

export interface BulkUpdateProposedChangesPreviewProps {
  org: SalesforceOrgUi;
  sobject: string;
  proposedChanges: ProposedChangesResult;
  configuration: MetadataRowConfiguration[];
  /** Total number of records that were fetched/targeted (impacted + unaffected) */
  totalFetched: number;
}

/**
 * Renders the "current vs proposed" preview table for the impacted records, plus the ability to
 * download a backup of the current values or the proposed values (Id + impacted fields only).
 */
export const BulkUpdateProposedChangesPreview: FunctionComponent<BulkUpdateProposedChangesPreviewProps> = ({
  org,
  sobject,
  proposedChanges,
  configuration,
  totalFetched,
}) => {
  const { trackEvent } = useAmplitude();
  const { serverUrl, defaultApiVersion, google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const skipFrontdoorLogin = useAtomValue(selectSkipFrontdoorAuth);
  const [downloadModal, setDownloadModal] = useState<DownloadModalState>({ open: false, data: [], header: [], fileNameParts: [] });

  const { fields, records, impactedRecordIds } = proposedChanges;

  const columns = useMemo<ColumnWithFilter<RowWithKey>[]>(() => {
    const baseColumns: ColumnWithFilter<RowWithKey>[] = [
      {
        ...setColumnFromType('Id', 'salesforceId'),
        key: 'Id',
        name: 'Record Id',
        resizable: true,
        width: 175,
      } as ColumnWithFilter<RowWithKey>,
    ];
    fields.forEach((field) => {
      baseColumns.push({
        key: `${field}__current`,
        name: `${field} (Current)`,
        resizable: true,
        sortable: true,
        width: 200,
        cellClass: 'slds-truncate slds-text-color_weak',
        renderCell: ({ row }) => row[`${field}__current`],
      } as ColumnWithFilter<RowWithKey>);
      baseColumns.push({
        key: `${field}__new`,
        name: `${field} (New)`,
        resizable: true,
        sortable: true,
        width: 200,
        cellClass: (row: RowWithKey) => (row[`${field}__changed`] ? 'slds-is-edited slds-truncate' : 'slds-truncate'),
        renderCell: ({ row }) => row[`${field}__new`],
      } as ColumnWithFilter<RowWithKey>);
    });
    return baseColumns;
  }, [fields]);

  const rows = useMemo<RowWithKey[]>(
    () =>
      records.map((record) => {
        const row: RowWithKey = { _key: record.recordId, Id: record.recordId };
        record.changes.forEach((change) => {
          row[`${change.field}__current`] = formatProposedValue(change.currentValue);
          row[`${change.field}__new`] = formatProposedValue(change.newValue);
          row[`${change.field}__changed`] = change.willChange;
        });
        return row;
      }),
    [records],
  );

  const getRowKey = useCallback((row: RowWithKey) => row._key, []);

  function handleDownloadBackup(variant: 'before' | 'after') {
    const header = ['Id', ...fields];
    const data = records.map((record) => {
      const output: Record<string, unknown> = { Id: record.recordId };
      record.changes.forEach((change) => {
        output[change.field] = variant === 'before' ? change.currentValue : change.newValue;
      });
      return output;
    });
    setDownloadModal({
      open: true,
      data,
      header,
      fileNameParts: [sobject.toLowerCase(), variant === 'before' ? 'backup-before' : 'backup-after'],
    });
    trackEvent(ANALYTICS_KEYS.mass_update_DownloadRecords, {
      type: variant === 'before' ? 'preview-backup-before' : 'preview-backup-after',
      numRows: data.length,
      transformationOptions: configuration.map(({ transformationOptions }) => transformationOptions.option),
    });
  }

  function handleDownloadClose() {
    setDownloadModal((prev) => ({ ...prev, open: false }));
  }

  return (
    <Fragment>
      {downloadModal.open && (
        <FileDownloadModal
          org={org}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Download Backup"
          data={downloadModal.data}
          header={downloadModal.header}
          fileNameParts={downloadModal.fileNameParts}
          onModalClose={handleDownloadClose}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          source="bulk_update_query_preview"
          trackEvent={trackEvent}
        />
      )}

      <Grid align="spread" verticalAlign="center" wrap className="slds-m-vertical_x-small slds-m-horizontal_xx-small">
        <p className="slds-text-body_small">
          <strong>{formatNumber(impactedRecordIds.length)}</strong> of {formatNumber(totalFetched)}{' '}
          {pluralizeFromNumber('record', totalFetched)} will be updated. Review the proposed changes before saving.
        </p>
        <div>
          <button className="slds-button slds-button_neutral" onClick={() => handleDownloadBackup('before')}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download current values
          </button>
          <button className="slds-button slds-button_neutral" onClick={() => handleDownloadBackup('after')}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download proposed values
          </button>
        </div>
      </Grid>

      <div className="slds-is-relative slds-scrollable_x">
        <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={200}>
          <DataTable
            org={org}
            serverUrl={serverUrl}
            skipFrontdoorLogin={skipFrontdoorLogin}
            columns={columns}
            data={rows}
            getRowKey={getRowKey}
            rowHeight={25}
            context={{ defaultApiVersion }}
          />
        </AutoFullHeightContainer>
      </div>
    </Fragment>
  );
};

export default BulkUpdateProposedChangesPreview;
