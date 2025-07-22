import { css } from '@emotion/react';
import { ANALYTICS_KEYS, MIME_TYPES } from '@jetstream/shared/constants';
import { getFilenameWithoutOrg, prepareCsvFile, saveFile } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { Icon, Popover, PopoverRef, Radio, RadioGroup } from '@jetstream/ui';
import { dexieDb } from '@jetstream/ui/db';
import isDate from 'lodash/isDate';
import { FunctionComponent, useRef, useState } from 'react';
import { useAmplitude } from '../..';

type ExportScope = 'ALL' | 'CURRENT';
type ExportType = 'ALL' | 'FAVORITES';

export interface QueryHistoryExportPopoverProps {
  selectedOrg: SalesforceOrgUi;
  whichType: 'HISTORY' | 'SAVED';
}

export const QueryHistoryExportPopover: FunctionComponent<QueryHistoryExportPopoverProps> = ({ selectedOrg, whichType }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const { trackEvent } = useAmplitude();
  const [exportScope, setExportScope] = useState<ExportScope>('ALL');
  const [exportType, setExportType] = useState<ExportType>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      // Build filter function based on export type and which type
      const filterFn = (item: QueryHistoryItem) => {
        if (exportScope === 'CURRENT' && item.org !== selectedOrg.uniqueId) {
          return false;
        }
        if (whichType === 'SAVED' && !item.isFavorite) {
          return false;
        }
        if (exportType === 'FAVORITES' && !item.isFavorite) {
          return false;
        }
        return true;
      };

      // Get query history items
      const queryHistory = await dexieDb.query_history.orderBy('lastRun').reverse().filter(filterFn).toArray();

      if (queryHistory.length === 0) {
        return;
      }

      // Transform data for CSV export
      const csvData = orderObjectsBy(queryHistory, ['sObject', 'lastRun']).map((item) => ({
        // TODO: should we show org label if available? (we need to fetch all orgs)
        Org: item.org.split('-')[0],
        Object: item.sObject,
        Label: item.customLabel || item.label,
        Query: item.soql,
        'Metadata Query': item.isTooling ? 'true' : 'false',
        Saved: item.isFavorite ? 'true' : 'false',
        'Last Run': isDate(item.lastRun) ? item.lastRun.toISOString() : item.lastRun,
        Created: isDate(item.createdAt) ? item.createdAt.toISOString() : item.createdAt,
        'Run Count': String(item.runCount ?? 0),
      }));

      // Prepare CSV file
      const csvContent = prepareCsvFile(csvData, Object.keys(csvData[0]));
      const filename = `${getFilenameWithoutOrg(['soql-export'])}.csv`;
      saveFile(csvContent, filename, MIME_TYPES.CSV);

      // Track event
      trackEvent(ANALYTICS_KEYS.query_HistoryExport, {
        exportType: exportScope,
        whichType,
        count: queryHistory.length,
      });

      // Close popover
      popoverRef.current?.close();
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Popover
      ref={popoverRef}
      omitPortal
      placement="bottom-end"
      footer={
        <footer className="slds-popover__footer">
          <div className="slds-grid slds-grid_vertical-align-center slds-grid_align-end">
            <button className="slds-button slds-button_brand slds-m-top_x-small" onClick={handleExport} disabled={isExporting}>
              Save
            </button>
          </div>
        </footer>
      }
      content={
        <div
          css={css`
            min-width: 300px;
            text-align: left;
          `}
        >
          <h3 className="slds-text-heading_small slds-m-bottom_small">Export Query History</h3>

          <RadioGroup label="Which Orgs?" helpText={selectedOrg.label} className="slds-m-bottom_x-small">
            <Radio
              name="export-scope"
              label="All Organizations"
              value="ALL"
              checked={exportScope === 'ALL'}
              onChange={(value) => setExportScope(value as ExportScope)}
            />
            <Radio
              name="export-scope"
              label="Current Organization"
              value="CURRENT"
              checked={exportScope === 'CURRENT'}
              onChange={(value) => setExportScope(value as ExportScope)}
            />
          </RadioGroup>

          <RadioGroup label="Which Queries?" className="slds-m-bottom_small">
            <Radio
              name="export-type"
              label="All Queries"
              value="ALL"
              checked={exportType === 'ALL'}
              onChange={(value) => setExportType(value as ExportType)}
            />
            <Radio
              name="export-type"
              label="Saved Queries"
              value="FAVORITES"
              checked={exportType === 'FAVORITES'}
              onChange={(value) => setExportType(value as ExportType)}
            />
          </RadioGroup>
        </div>
      }
      buttonProps={{ className: 'slds-button slds-p-left_small' }}
    >
      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
      Export
    </Popover>
  );
};
