import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Badge } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';
import { PermissionChangeSection, getPermissionChangeTotals } from './utils/permission-change-summary';

/** Rows shown per section before the rest is collapsed behind "Show all" */
const COLLAPSED_ROW_LIMIT = 15;

export interface PermissionChangeSummaryProps {
  sections: PermissionChangeSection[];
}

/**
 * Body of the save confirmation: every change that is about to be sent to Salesforce, grouped by tab, so the user can
 * check the exact profile / permission set and flags rather than just a count.
 */
export const PermissionChangeSummary: FunctionComponent<PermissionChangeSummaryProps> = ({ sections }) => {
  const { changeCount, profileCount, permissionSetCount } = getPermissionChangeTotals(sections);
  const targets = [
    profileCount ? `${formatNumber(profileCount)} ${pluralizeFromNumber('profile', profileCount)}` : null,
    permissionSetCount ? `${formatNumber(permissionSetCount)} ${pluralizeFromNumber('permission set', permissionSetCount)}` : null,
  ].filter(Boolean);

  return (
    <div data-testid="permission-change-summary">
      <p className="slds-m-bottom_small">
        You are about to save <strong>{formatNumber(changeCount)}</strong> {pluralizeFromNumber('change', changeCount)} to{' '}
        <strong>{targets.join(' and ')}</strong>.
      </p>
      {sections.map((section) => (
        <PermissionChangeSectionTable key={section.key} section={section} />
      ))}
    </div>
  );
};

const PermissionChangeSectionTable: FunctionComponent<{ section: PermissionChangeSection }> = ({ section }) => {
  const [showAll, setShowAll] = useState(false);
  const { title, itemHeader, changes } = section;
  const visibleChanges = showAll ? changes : changes.slice(0, COLLAPSED_ROW_LIMIT);
  const hiddenCount = changes.length - visibleChanges.length;

  return (
    <div className="slds-m-bottom_medium">
      <h3 className="slds-text-heading_small slds-m-bottom_x-small">
        {title} <span className="slds-text-color_weak slds-text-body_regular">({formatNumber(changes.length)})</span>
      </h3>
      <table className="slds-table slds-table_cell-buffer slds-table_bordered slds-table_fixed-layout slds-table_header-fixed_container">
        <thead>
          <tr className="slds-line-height_reset">
            <th scope="col" className="slds-cell-wrap">
              {itemHeader}
            </th>
            <th scope="col" className="slds-cell-wrap">
              Profile / Permission Set
            </th>
            <th scope="col" className="slds-cell-wrap">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {visibleChanges.map(({ key, itemLabel, itemDetail, parentLabel, parentType, flags }) => (
            <tr key={key}>
              <td className="slds-cell-wrap">
                <div title={itemDetail ? `${itemLabel} (${itemDetail})` : itemLabel}>
                  <div className="slds-truncate">{itemLabel}</div>
                  {itemDetail && itemDetail !== itemLabel && (
                    <div className="slds-text-body_small slds-text-color_weak slds-truncate">{itemDetail}</div>
                  )}
                </div>
              </td>
              <td className="slds-cell-wrap">
                <div className="slds-truncate" title={parentLabel}>
                  {parentLabel}
                </div>
                <div className="slds-text-body_small slds-text-color_weak">{parentType}</div>
              </td>
              <td className="slds-cell-wrap">
                <div
                  css={css`
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem;
                  `}
                >
                  {flags.map(({ label, enabled }) => (
                    <Badge key={label} type={enabled ? 'success' : 'light'} title={`${label} will be turned ${enabled ? 'on' : 'off'}`}>
                      {label}: {enabled ? 'On' : 'Off'}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {hiddenCount > 0 && (
        <button type="button" className="slds-button slds-m-top_x-small" onClick={() => setShowAll(true)}>
          Show all {formatNumber(changes.length)} changes
        </button>
      )}
    </div>
  );
};

export default PermissionChangeSummary;
