import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { deleteOrg } from '@jetstream/shared/data';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  ariaDisabledButtonProps,
  Badge,
  Checkbox,
  fireToast,
  Grid,
  Icon,
  Modal,
  RadioButton,
  RadioGroup,
  Spinner,
  useAnnouncer,
} from '@jetstream/ui';
import { useAmplitude } from '@jetstream/ui-core';
import classNames from 'classnames';
import groupBy from 'lodash/groupBy';
import sortBy from 'lodash/sortBy';
import { useMemo, useState } from 'react';

interface DeleteOrgsModalProps {
  orgs: SalesforceOrgUi[];
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteOrgsModal = ({ orgs, onClose, onDeleted }: DeleteOrgsModalProps) => {
  const { trackEvent } = useAmplitude();
  const [selectedOrgIds, setSelectedOrgIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'errors'>('all');

  const orgsWithErrors = useMemo(() => orgs.filter((org) => org.connectionError), [orgs]);

  const visibleOrgs = useMemo(() => {
    return filterMode === 'errors' ? orgsWithErrors : orgs;
  }, [filterMode, orgs, orgsWithErrors]);

  const orgsByOrgName = useMemo(() => groupBy(sortBy(visibleOrgs, ['label']), 'orgName'), [visibleOrgs]);

  const visibleOrgIds = useMemo(() => new Set(visibleOrgs.map((org) => org.uniqueId)), [visibleOrgs]);

  const selectAllState = useMemo(() => {
    const selectedVisibleCount = visibleOrgs.filter((org) => selectedOrgIds.has(org.uniqueId)).length;
    if (selectedVisibleCount === 0) return 'none';
    if (selectedVisibleCount === visibleOrgs.length) return 'all';
    return 'some';
  }, [visibleOrgs, selectedOrgIds]);

  function handleToggleOrg(uniqueId: string) {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      if (next.has(uniqueId)) {
        next.delete(uniqueId);
      } else {
        next.add(uniqueId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectAllState === 'all') {
      setSelectedOrgIds((prev) => {
        const next = new Set(prev);
        visibleOrgIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedOrgIds((prev) => new Set([...prev, ...visibleOrgIds]));
    }
  }

  // The delete button's label swap to "Are you sure?" is not announced on its own
  const { announce, announcer } = useAnnouncer();

  async function handleConfirmOrDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      announce(`Press again to confirm deleting ${selectedOrgIds.size} ${pluralizeFromNumber('org', selectedOrgIds.size)}`);
      return;
    }
    setIsDeleting(true);
    const orgsToDelete = orgs.filter((org) => selectedOrgIds.has(org.uniqueId));
    let successCount = 0;
    let errorCount = 0;

    for (const org of orgsToDelete) {
      try {
        await deleteOrg(org);
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setIsDeleting(false);
    trackEvent(ANALYTICS_KEYS.sfdc_org_bulk_deleted, {
      selectedCount: orgsToDelete.length,
      successCount,
      errorCount,
      filterMode,
      totalOrgCount: orgs.length,
    });

    if (successCount > 0) {
      fireToast({
        message: `Successfully deleted ${successCount} ${pluralizeFromNumber('org', successCount)}${errorCount > 0 ? `. Failed to delete ${errorCount} ${pluralizeFromNumber('org', errorCount)}.` : '.'}`,
        type: errorCount > 0 ? 'warning' : 'success',
      });
      onDeleted();
    } else {
      fireToast({
        message: `Failed to delete orgs. Please try again.`,
        type: 'error',
      });
    }
  }

  return (
    <Modal
      header="Delete Salesforce Orgs"
      onClose={onClose}
      size="lg"
      closeDisabled={isDeleting}
      footer={
        <Grid align="spread" verticalAlign="center">
          <p className="slds-text-color_destructive slds-text-align_center">
            {selectedOrgIds.size > 0 && (
              <strong>
                This action will permanently delete {selectedOrgIds.size} Salesforce {pluralizeFromNumber('org', selectedOrgIds.size)}
              </strong>
            )}
          </p>
          <div>
            <button className="slds-button slds-button_neutral" onClick={onClose} disabled={isDeleting}>
              Cancel
            </button>

            <button
              className={classNames('slds-button slds-is-relative', {
                'slds-button_text-destructive': !confirmDelete,
                'slds-button_destructive': confirmDelete,
              })}
              // aria-disabled keeps focus on the button while its second click disables it
              {...ariaDisabledButtonProps(selectedOrgIds.size === 0 || isDeleting, () => handleConfirmOrDelete())}
            >
              <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" />
              {confirmDelete ? (
                'Are you sure?'
              ) : (
                <>
                  Delete {selectedOrgIds.size} {pluralizeFromNumber('Org', selectedOrgIds.size)}
                </>
              )}
              {isDeleting && <Spinner size="small" />}
            </button>
          </div>
        </Grid>
      }
    >
      {announcer}
      {orgsWithErrors.length > 0 && (
        <RadioGroup label="Filter Orgs" isButtonGroup className="slds-m-bottom_small">
          <RadioButton
            id="delete-orgs-filter-all"
            name="filter-mode"
            label="All Orgs"
            value="all"
            checked={filterMode === 'all'}
            disabled={isDeleting}
            onChange={(value) => setFilterMode(value as 'all' | 'errors')}
          />
          <RadioButton
            id="delete-orgs-filter-errors"
            name="filter-mode"
            label="Orgs with Connection Error"
            value="errors"
            checked={filterMode === 'errors'}
            disabled={isDeleting}
            onChange={(value) => setFilterMode(value as 'all' | 'errors')}
          />
        </RadioGroup>
      )}

      <div className="slds-m-bottom_small slds-m-left_small">
        <Checkbox
          id="select-all"
          checked={selectAllState === 'all'}
          indeterminate={selectAllState === 'some'}
          label="Select All"
          disabled={isDeleting || visibleOrgs.length === 0}
          onChange={handleSelectAll}
        />
      </div>

      {Object.entries(orgsByOrgName).map(([orgName, groupOrgs]) => (
        <div key={orgName || 'Unknown'} className="slds-m-bottom_medium">
          <h3 className="slds-text-heading_small">{orgName || 'Unknown Organization'}</h3>
          <div className=" slds-border_bottom">
            {groupOrgs.map((org) => (
              <div key={org.uniqueId} className="slds-p-vertical_x-small slds-p-horizontal_small">
                <OrgCheckbox
                  org={org}
                  checked={selectedOrgIds.has(org.uniqueId)}
                  disabled={isDeleting}
                  onChange={() => handleToggleOrg(org.uniqueId)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
};

const OrgCheckbox = ({
  org,
  checked,
  disabled,
  onChange,
}: {
  org: SalesforceOrgUi;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) => {
  const updatedAt = org.lastActivityAt || org.updatedAt;
  const updatedAtText = updatedAt ? `Last activity ${new Date(updatedAt).toLocaleDateString()}` : '';
  return (
    <Checkbox
      id={`org-${org.uniqueId}`}
      checked={checked}
      label={org.username}
      // Plain text: the details used to toggle the checkbox on click, a mouse-only path that
      // duplicated the label's own click-to-toggle without a keyboard equivalent
      helpText={
        <div className="slds-m-left_large">
          <div className="slds-text-body_small slds-text-color_weak">
            <div>Org Id: {org.organizationId}</div>
            <div>{org.instanceUrl}</div>
          </div>
          {updatedAtText && <div className="slds-m-top_xx-small slds-text-body_small slds-text-color_weak">{updatedAtText}</div>}
          {org.connectionError && <Badge type="error">Connection Error</Badge>}
        </div>
      }
      disabled={disabled}
      onChange={() => onChange()}
    />
  );
};
