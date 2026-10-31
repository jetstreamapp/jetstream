import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import { AutomationControlHistoryEntry, AutomationControlRestoreAction, SalesforceOrgUi } from '@jetstream/types';
import {
  Badge,
  EmptyState,
  focusListEntryRow,
  Grid,
  GridCol,
  List,
  Modal,
  OpenRoadIllustration,
  ScopedNotification,
  SearchInput,
  ShowingCountStatus,
  Spinner,
} from '@jetstream/ui';
import { applicationCookieState } from '@jetstream/ui/app-state';
import { AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG, automationControlHistoryDb } from '@jetstream/ui/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useMemo, useRef, useState } from 'react';
import { getAutomationTypeLabel } from './automation-control-data-utils';
import { formatHistoryDate, getHistoryActionLabel, getHistoryStatus } from './automation-control-history-utils';
import { getPackageItemsFromHistory } from './automation-control-package-utils';
import AutomationControlHistoryEntryDetail from './AutomationControlHistoryEntryDetail';
import { AutomationPackageDownloadModal } from './AutomationControlPackageDownload';
import { useAutomationPackageDownload } from './useAutomationPackageDownload';

interface HistoryListRow {
  key: string;
  entry: AutomationControlHistoryEntry;
  /** Date, action, objects and item names, for the filter input */
  searchText: string;
}

function getListRow(entry: AutomationControlHistoryEntry): HistoryListRow {
  return {
    key: entry.key,
    entry,
    searchText: [
      formatHistoryDate(entry.createdAt),
      getHistoryActionLabel(entry.action),
      ...entry.sobjects,
      ...entry.types.map(getAutomationTypeLabel),
      ...entry.items.map(({ label }) => label),
    ].join(' '),
  };
}

export interface AutomationControlHistoryModalProps {
  selectedOrg: SalesforceOrgUi;
  onRestore: (entry: AutomationControlHistoryEntry, action: AutomationControlRestoreAction) => void;
  onClose: () => void;
}

export const AutomationControlHistoryModal: FunctionComponent<AutomationControlHistoryModalProps> = ({
  selectedOrg,
  onRestore,
  onClose,
}) => {
  const { defaultApiVersion } = useAtomValue(applicationCookieState);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');
  const { preparingVariant, packageDownload, packageError, preparePackage, closePackageDownload, packageTriggerRef, modalInitialFocus } =
    useAutomationPackageDownload(selectedOrg, defaultApiVersion, 'history');
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useLiveQuery(() => automationControlHistoryDb.getEntries(selectedOrg.uniqueId), [selectedOrg.uniqueId]);
  const loading = entries === undefined;

  const listRows = useMemo(() => (entries || []).map(getListRow), [entries]);
  const filteredListRows = useMemo(
    () => (filterValue ? listRows.filter(multiWordObjectFilter<HistoryListRow>(['searchText'], filterValue)) : listRows),
    [listRows, filterValue],
  );

  const selectedEntry = (filteredListRows.find(({ key }) => key === selectedKey) || filteredListRows[0])?.entry;

  return (
    <Fragment>
      <Modal
        header="Automation History"
        tagline={`Changes deployed to this org from Automation Control. The last ${AUTOMATION_CONTROL_HISTORY_MAX_ENTRIES_PER_ORG} deployments are kept in this browser.`}
        size="lg"
        hide={!!packageDownload}
        initialFocus={modalInitialFocus}
        classStyles={css`
          min-height: 75vh;
          max-height: 75vh;
        `}
        footer={
          <button className="slds-button slds-button_neutral" onClick={onClose}>
            Close
          </button>
        }
        onClose={onClose}
      >
        {packageError && (
          <ScopedNotification theme="error" className="slds-m-bottom_x-small" allowClose dismissResetKey={packageError}>
            {packageError}
          </ScopedNotification>
        )}
        {loading && <Spinner />}
        {!loading && listRows.length === 0 && (
          <EmptyState
            headline="No automation changes yet"
            subHeading="Each time you deploy changes from Automation Control they are saved here, so you can roll them back or re-deploy them later."
            illustration={<OpenRoadIllustration />}
          />
        )}
        {!loading && listRows.length > 0 && (
          <Grid
            css={css`
              height: calc(75vh - 10rem);
            `}
          >
            <GridCol size={12} sizeMedium={4} className="slds-scrollable_y slds-p-right_small">
              <SearchInput
                id="automation-history-filter"
                ariaLabel="Filter deployments"
                placeholder="Filter by object, automation, or date"
                value={filterValue}
                onChange={setFilterValue}
                onArrowKeyUpDown={() => focusListEntryRow(listRef.current)}
              />
              <ShowingCountStatus
                className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small slds-p-vertical_xx-small"
                filteredCount={filteredListRows.length}
                totalCount={listRows.length}
                singularNoun="deployment"
              />
              <List
                ref={listRef}
                ariaLabel="Deployment history"
                items={filteredListRows}
                isActive={({ entry }: HistoryListRow) => entry.key === selectedEntry?.key}
                onSelected={setSelectedKey}
                getContent={({ key, entry }: HistoryListRow) => {
                  const status = getHistoryStatus(entry);
                  return {
                    key,
                    heading: (
                      <Grid verticalAlign="center" align="spread">
                        <span className="slds-truncate">{formatHistoryDate(entry.createdAt)}</span>
                        <Badge type={status.badgeType}>{status.label}</Badge>
                      </Grid>
                    ),
                    subheading: `${getHistoryActionLabel(entry.action)} ${formatNumber(entry.items.length)} ${pluralizeFromNumber(
                      'item',
                      entry.items.length,
                    )}`,
                    children: (
                      <p className="slds-text-body_small slds-text-color_weak slds-truncate" title={entry.sobjects.join(', ')}>
                        {entry.sobjects.join(', ')}
                      </p>
                    ),
                  };
                }}
              />
            </GridCol>
            <GridCol className="slds-p-left_small">
              {selectedEntry && (
                <AutomationControlHistoryEntryDetail
                  entry={selectedEntry}
                  isPreparingPackage={!!preparingVariant}
                  packageTriggerRef={packageTriggerRef}
                  onRestore={onRestore}
                  onDownloadPackage={(entry, variant) => preparePackage(getPackageItemsFromHistory(entry.items, variant), variant)}
                />
              )}
            </GridCol>
          </Grid>
        )}
      </Modal>
      {packageDownload && (
        <AutomationPackageDownloadModal
          selectedOrg={selectedOrg}
          packageDownload={packageDownload}
          source="automation_control_history"
          onClose={closePackageDownload}
        />
      )}
    </Fragment>
  );
};

export default AutomationControlHistoryModal;
