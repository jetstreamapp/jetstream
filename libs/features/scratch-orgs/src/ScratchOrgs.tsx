import { css } from '@emotion/react';
import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { addOrg, useTitle } from '@jetstream/shared/ui-utils';
import { getErrorMessage, multiWordObjectFilter } from '@jetstream/shared/utils';
import type { AddOrgHandlerFn, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Checkbox,
  ConfirmationModalPromise,
  DisabledReasonButton,
  EmptyState,
  fireToast,
  Grid,
  Icon,
  NoAccess2Illustration,
  OpenRoadIllustration,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  SearchInput,
  Spinner,
} from '@jetstream/ui';
import {
  ActiveOrgGroupState,
  applicationCookieState,
  salesforceOrgsState,
  selectedOrgIdState,
  selectedOrgState,
  useOperationAccess,
} from '@jetstream/ui/app-state';
import { formatDate } from 'date-fns/format';
import { useAtomValue, useSetAtom } from 'jotai';
import { FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import CreateScratchOrgModal from './components/CreateScratchOrgModal';
import ScratchOrgDetailPanel from './components/ScratchOrgDetailPanel';
import ScratchOrgLimits from './components/ScratchOrgLimits';
import ScratchOrgsTable from './components/ScratchOrgsTable';
import { MAX_SCRATCH_ORGS } from './scratch-org-data.utils';
import type { PendingScratchOrg, ScratchOrgRow } from './scratch-org.types';
import { toScratchOrgRows } from './scratch-org.utils';
import { useScratchOrgActions } from './useScratchOrgActions';
import { useScratchOrgs } from './useScratchOrgs';

const HEIGHT_BUFFER = 170;
/** Rows rendered at a time, a Dev Hub's history of deleted scratch orgs can run into the thousands */
const PAGE_SIZE = 100;

const FILTER_FIELDS: (keyof ScratchOrgRow)[] = [
  'OrgName',
  'SignupUsername',
  'Edition',
  'createdByName',
  'displayStatus',
  'ScratchOrg',
  'Description',
];

export interface ScratchOrgsProps {
  /** How a scratch org that was created outside of Jetstream is connected with its password, the desktop app has its own flow */
  onAddOrgHandlerFn?: AddOrgHandlerFn;
}

export const ScratchOrgs: FunctionComponent<ScratchOrgsProps> = ({ onAddOrgHandlerFn = addOrg }) => {
  useTitle(TITLES.SCRATCH_ORGS);
  const navigate = useNavigate();
  const devHubOrg = useAtomValue(selectedOrgState);
  const orgs = useAtomValue(salesforceOrgsState);
  const { serverUrl } = useAtomValue(applicationCookieState);
  const setSelectedOrgId = useSetAtom(selectedOrgIdState);
  const setActiveOrgGroup = useSetAtom(ActiveOrgGroupState);
  const createAccess = useOperationAccess('records.write');
  const deleteAccess = useOperationAccess('records.delete');
  const connectAccess = useOperationAccess('orgs.connect');
  const deployAccess = useOperationAccess('metadata.deploy');

  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const { records, limits, hasMore, loading, refreshing, errorMessage, isNotDevHub, lastChecked, refresh } = useScratchOrgs(
    devHubOrg,
    includeDeleted,
  );
  const { connect, remove, refetchOrgs, trackPendingScratchOrg, pendingSteps, connectingIds } = useScratchOrgActions(
    devHubOrg,
    records,
    refresh,
  );

  const rows = useMemo(() => toScratchOrgRows(records, orgs), [records, orgs]);
  const filteredRows = useMemo(() => {
    const ownRows = onlyMine ? rows.filter(({ CreatedById }) => CreatedById?.slice(0, 15) === devHubOrg.userId?.slice(0, 15)) : rows;
    return searchTerm ? ownRows.filter(multiWordObjectFilter(FILTER_FIELDS, searchTerm)) : ownRows;
  }, [devHubOrg.userId, onlyMine, rows, searchTerm]);
  const selectedRow = useMemo(() => rows.find(({ Id }) => Id === selectedId) ?? null, [rows, selectedId]);

  // The selection, filters and pagination describe the prior Dev Hub's scratch orgs
  useEffect(() => {
    setSelectedId(null);
    setCreateModalOpen(false);
    setSearchTerm('');
    setVisibleCount(PAGE_SIZE);
    setDeletingIds(new Set());
  }, [devHubOrg.uniqueId]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [includeDeleted, onlyMine, searchTerm]);

  // A scratch org that left the list (deleted elsewhere, or filtered out) should not reopen its panel later
  useEffect(() => {
    if (selectedId && !loading && !rows.some(({ Id }) => Id === selectedId)) {
      setSelectedId(null);
    }
  }, [loading, rows, selectedId]);

  const handleCreated = useCallback(
    (pendingScratchOrg: PendingScratchOrg) => {
      setCreateModalOpen(false);
      trackPendingScratchOrg(pendingScratchOrg);
      fireToast({ type: 'info', message: `Scratch org "${pendingScratchOrg.orgName}" was requested, Salesforce is creating it.` });
      refresh();
    },
    [refresh, trackPendingScratchOrg],
  );

  const handleConnect = useCallback(
    async ({ Id, OrgName, SignupUsername }: ScratchOrgRow) => {
      try {
        await connect(Id);
        fireToast({ type: 'success', message: `${OrgName || SignupUsername || 'The scratch org'} is connected to Jetstream.` });
      } catch (ex) {
        fireToast({ type: 'error', message: getErrorMessage(ex) });
      }
    },
    [connect],
  );

  /** Standard OAuth login for scratch orgs that were created by another tool, the user needs to know the password */
  const handleConnectWithPassword = useCallback(
    ({ LoginUrl, SignupUsername }: ScratchOrgRow) => {
      if (!LoginUrl) {
        fireToast({ type: 'error', message: 'This scratch org does not have a login url.' });
        return;
      }
      onAddOrgHandlerFn(
        {
          serverUrl,
          loginUrl: LoginUrl,
          loginHint: SignupUsername ?? undefined,
          orgGroupId: devHubOrg.jetstreamOrganizationId,
        },
        () => {
          // Refetched rather than added in memory so that the Dev Hub stays the selected org
          refetchOrgs();
        },
      );
    },
    [devHubOrg.jetstreamOrganizationId, onAddOrgHandlerFn, refetchOrgs, serverUrl],
  );

  const handleDelete = useCallback(
    async ({ Id, Status, OrgName, SignupUsername, displayStatus, connectedOrgs }: ScratchOrgRow) => {
      const name = OrgName || SignupUsername || 'this scratch org';
      const confirmed = await ConfirmationModalPromise({
        header: 'Delete Scratch Org',
        content:
          displayStatus === 'Error'
            ? `Remove the failed request for ${name} from the Dev Hub?`
            : `Delete ${name}${SignupUsername && OrgName ? ` (${SignupUsername})` : ''}? The scratch org and everything in it is permanently deleted, this cannot be undone.${connectedOrgs.length ? ' Its connection is removed from Jetstream as well.' : ''}`,
        confirm: 'Delete',
      });
      if (!confirmed) {
        return;
      }
      setDeletingIds((priorIds) => new Set(priorIds).add(Id));
      try {
        await remove({ Id, Status }, connectedOrgs);
        setSelectedId((priorId) => (priorId === Id ? null : priorId));
        fireToast({ type: 'success', message: `${name} was deleted.` });
      } catch (ex) {
        fireToast({ type: 'error', message: `Unable to delete ${name}. ${getErrorMessage(ex)}` });
      } finally {
        setDeletingIds((priorIds) => {
          const ids = new Set(priorIds);
          ids.delete(Id);
          return ids;
        });
      }
    },
    [remove],
  );

  const handleSwitchToOrg = useCallback(
    (org: SalesforceOrgUi) => {
      // The org picker only offers the orgs of the active group
      setActiveOrgGroup(org.jetstreamOrganizationId ?? null);
      setSelectedOrgId(org.uniqueId);
      navigate(APP_ROUTES.HOME.ROUTE);
    },
    [navigate, setActiveOrgGroup, setSelectedOrgId],
  );

  const visibleRows = filteredRows.slice(0, visibleCount);

  return (
    <Page testId="scratch-orgs-page">
      {createModalOpen && (
        <CreateScratchOrgModal
          devHubOrg={devHubOrg}
          limits={limits}
          connectDeniedReason={connectAccess.deniedReason}
          settingsDeniedReason={deployAccess.deniedReason}
          onClose={() => setCreateModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
      <ScratchOrgDetailPanel
        row={selectedRow}
        serverUrl={serverUrl}
        pendingStep={selectedRow ? pendingSteps[selectedRow.Id] : undefined}
        isConnecting={!!selectedRow && connectingIds.has(selectedRow.Id)}
        isDeleting={!!selectedRow && deletingIds.has(selectedRow.Id)}
        connectDeniedReason={connectAccess.deniedReason}
        deleteDeniedReason={deleteAccess.deniedReason}
        writeDeniedReason={createAccess.deniedReason}
        onConnect={handleConnect}
        onConnectWithPassword={handleConnectWithPassword}
        onDelete={handleDelete}
        onSwitchToOrg={handleSwitchToOrg}
        onClose={() => setSelectedId(null)}
      />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'environment_hub' }}
            label="Scratch Orgs"
            docsPath={APP_ROUTES.SCRATCH_ORGS.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            <button className="slds-button slds-button_neutral slds-is-relative" disabled={refreshing} onClick={() => refresh()}>
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
              Refresh
            </button>
            <DisabledReasonButton
              className="slds-button slds-button_brand"
              disabled={!createAccess.allowed || isNotDevHub}
              disabledReason={createAccess.deniedReason ?? (isNotDevHub ? 'Select a Dev Hub org to create scratch orgs' : null)}
              onClick={() => setCreateModalOpen(true)}
            >
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              New Scratch Org
            </DisabledReasonButton>
          </PageHeaderActions>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer bottomBuffer={10} className="slds-p-horizontal_x-small slds-is-relative" bufferIfNotRendered={HEIGHT_BUFFER}>
        {isNotDevHub && (
          <EmptyState
            headline="This org is not a Dev Hub"
            subHeading="Choose a Dev Hub from the org dropdown to manage its scratch orgs."
            illustration={<NoAccess2Illustration />}
          >
            <p className="slds-text-color_weak slds-m-top_x-small">
              A Dev Hub is a production, Developer Edition or trial org with Dev Hub enabled in Setup. Your user also needs access to the
              Scratch Org Infos and Active Scratch Orgs objects.
            </p>
          </EmptyState>
        )}
        {!isNotDevHub && (
          <>
            <Grid
              verticalAlign="center"
              wrap
              className="slds-p-vertical_x-small"
              css={css`
                gap: 0.5rem 1rem;
              `}
            >
              <ScratchOrgLimits limits={limits} />
              <div
                css={css`
                  flex: 1 1 14rem;
                  max-width: 24rem;
                `}
              >
                <SearchInput id="scratch-org-search" placeholder="Search scratch orgs" value={searchTerm} onChange={setSearchTerm} />
              </div>
              <Checkbox id="scratch-org-only-mine" label="Created by me" checked={onlyMine} onChange={setOnlyMine} />
              <Checkbox
                id="scratch-org-include-deleted"
                label="Show deleted and expired"
                checked={includeDeleted}
                onChange={setIncludeDeleted}
              />
              {lastChecked && (
                <span className="slds-text-body_small slds-text-color_weak slds-col_bump-left" title="The list refreshes automatically">
                  Last checked {formatDate(lastChecked, 'h:mm:ss a')}
                </span>
              )}
            </Grid>
            {errorMessage && (
              <ScopedNotification theme="error" className="slds-m-bottom_x-small">
                {errorMessage}
              </ScopedNotification>
            )}
            {hasMore && (
              <ScopedNotification theme="info" className="slds-m-bottom_x-small">
                This Dev Hub has more scratch orgs than can be listed, the {MAX_SCRATCH_ORGS.toLocaleString()} most recent are shown.
              </ScopedNotification>
            )}
            {loading && <Spinner />}
            {!loading && !rows.length && !errorMessage && (
              <EmptyState
                headline={
                  includeDeleted ? 'This Dev Hub does not have any scratch orgs' : 'This Dev Hub does not have any active scratch orgs'
                }
                subHeading="Create a scratch org to get a fresh, disposable Salesforce org in a minute or two."
                illustration={<OpenRoadIllustration />}
              >
                <DisabledReasonButton
                  className="slds-button slds-button_brand slds-m-top_small"
                  disabled={!createAccess.allowed}
                  disabledReason={createAccess.deniedReason}
                  onClick={() => setCreateModalOpen(true)}
                >
                  New Scratch Org
                </DisabledReasonButton>
              </EmptyState>
            )}
            {!!rows.length && !filteredRows.length && (
              <p className="slds-m-vertical_medium slds-text-align_center slds-text-color_weak">No scratch orgs match your filters.</p>
            )}
            {!!visibleRows.length && (
              <ScratchOrgsTable
                rows={visibleRows}
                selectedId={selectedId}
                serverUrl={serverUrl}
                pendingSteps={pendingSteps}
                connectingIds={connectingIds}
                deletingIds={deletingIds}
                connectDeniedReason={connectAccess.deniedReason}
                deleteDeniedReason={deleteAccess.deniedReason}
                onSelect={({ Id }) => setSelectedId(Id)}
                onConnect={handleConnect}
                onConnectWithPassword={handleConnectWithPassword}
                onDelete={handleDelete}
              />
            )}
            {filteredRows.length > visibleRows.length && (
              <Grid align="center" className="slds-m-vertical_small">
                <button className="slds-button slds-button_neutral" onClick={() => setVisibleCount((priorCount) => priorCount + PAGE_SIZE)}>
                  Show More ({(filteredRows.length - visibleRows.length).toLocaleString()} remaining)
                </button>
              </Grid>
            )}
          </>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
};

export default ScratchOrgs;
