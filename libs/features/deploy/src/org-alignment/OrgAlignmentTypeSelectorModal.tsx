import { css } from '@emotion/react';
import { COMMON_METADATA_TYPES, getMetadataLabelFromFullName, METADATA_TYPES_TO_OMIT } from '@jetstream/connected-ui';
import { describeMetadata } from '@jetstream/shared/data';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { getErrorMessage, orderValues } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, Checkbox, Grid, Modal, ScopedNotification, SearchInput, Spinner, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { getMetadataTypeComparability } from './orgAlignmentMetadataClassification';
import { buildDescribeMetadataMap } from './useOrgAlignmentCompare';

export interface OrgAlignmentTypeSelectorModalProps {
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  initialSelectedTypes: string[];
  onApply: (selectedTypes: string[]) => void;
  onClose: () => void;
}

export const OrgAlignmentTypeSelectorModal: FunctionComponent<OrgAlignmentTypeSelectorModalProps> = ({
  sourceOrg,
  targetOrg,
  initialSelectedTypes,
  onApply,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(() => new Set(initialSelectedTypes));
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([describeMetadata(sourceOrg), describeMetadata(targetOrg)])
      .then(([{ data: sourceDescribe }, { data: targetDescribe }]) => {
        if (!active) {
          return;
        }
        const sourceMap = buildDescribeMetadataMap(sourceDescribe);
        const targetMap = buildDescribeMetadataMap(targetDescribe);
        const allTypes = orderValues(
          Array.from(new Set([...Object.keys(sourceMap), ...Object.keys(targetMap)])).filter((type) => !METADATA_TYPES_TO_OMIT.has(type)),
        );
        setErrorMessage(null);
        setAvailableTypes(allTypes);
      })
      .catch((ex) => {
        if (!active) {
          return;
        }
        setErrorMessage(getErrorMessage(ex));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [sourceOrg, targetOrg]);

  const filteredTypes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return availableTypes;
    }
    return availableTypes.filter((type) => {
      const label = getMetadataLabelFromFullName(type).toLowerCase();
      return type.toLowerCase().includes(query) || label.includes(query);
    });
  }, [availableTypes, searchTerm]);

  function toggleType(type: string, checked: boolean) {
    setSelectedSet((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(type);
      } else {
        next.delete(type);
      }
      return next;
    });
  }

  const filteredSelectedCount = useMemo(() => filteredTypes.filter((type) => selectedSet.has(type)).length, [filteredTypes, selectedSet]);
  const allFilteredSelected = filteredTypes.length > 0 && filteredSelectedCount === filteredTypes.length;

  /** Applies to the types matching the filter only, anything selected outside of the filter is left alone */
  function toggleAllFiltered(checked: boolean) {
    setSelectedSet((previous) => {
      const next = new Set(previous);
      filteredTypes.forEach((type) => (checked ? next.add(type) : next.delete(type)));
      return next;
    });
  }

  function handleSelectCommon() {
    const availableSet = new Set(availableTypes);
    setSelectedSet(
      new Set(COMMON_METADATA_TYPES.filter((type) => availableSet.has(type) && getMetadataTypeComparability(type).comparable)),
    );
  }

  function handleSelectAllComparable() {
    setSelectedSet(new Set(availableTypes.filter((type) => getMetadataTypeComparability(type).comparable)));
  }

  function handleClear() {
    setSelectedSet(new Set());
  }

  return (
    <Modal
      header="Select Metadata Types to Compare"
      tagline="Choose the metadata types to compare. Types marked Not Compared are specific to each org and are skipped automatically."
      size="md"
      footer={
        <Grid align="spread" verticalAlign="center">
          <div className="slds-text-body_small slds-text-color_weak">
            {formatNumber(selectedSet.size)} metadata {selectedSet.size === 1 ? 'type' : 'types'} selected
          </div>
          <Grid>
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="slds-button slds-button_brand"
              disabled={selectedSet.size === 0}
              onClick={() => onApply(orderValues(Array.from(selectedSet)))}
            >
              Apply Selection
            </button>
          </Grid>
        </Grid>
      }
      onClose={onClose}
    >
      <div className="slds-is-relative">
        {loading && <Spinner />}
        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            Failed to describe metadata types: {errorMessage}
          </ScopedNotification>
        )}
        <Grid align="spread" verticalAlign="center" wrap className="slds-m-bottom_small">
          <div className="slds-grow slds-m-right_small">
            <SearchInput
              id="org-alignment-type-search"
              placeholder="Filter metadata types..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value || '')}
            />
          </div>
          <div className="slds-button-group" role="group">
            <button type="button" className="slds-button slds-button_neutral" onClick={handleSelectCommon} disabled={loading}>
              Common
            </button>
            <button type="button" className="slds-button slds-button_neutral" onClick={handleSelectAllComparable} disabled={loading}>
              All
            </button>
            <button type="button" className="slds-button slds-button_neutral" onClick={handleClear} disabled={loading}>
              Clear
            </button>
          </div>
        </Grid>

        <div
          className="slds-box slds-box_x-small slds-scrollable_y"
          css={css`
            max-height: 50vh;
            min-height: 240px;
          `}
        >
          {filteredTypes.length === 0 && !loading && (
            <div className="slds-p-around_medium slds-text-align_center slds-text-color_weak">No metadata types match your filter.</div>
          )}
          {filteredTypes.length > 0 && (
            <div className="slds-p-vertical_xx-small slds-border_bottom">
              <Checkbox
                id="org-alignment-type-select-all"
                label={
                  searchTerm.trim()
                    ? `Select all ${formatNumber(filteredTypes.length)} matching types`
                    : `Select all ${formatNumber(filteredTypes.length)} types`
                }
                checked={allFilteredSelected}
                indeterminate={filteredSelectedCount > 0 && !allFilteredSelected}
                disabled={loading}
                onChange={toggleAllFiltered}
              />
            </div>
          )}
          <ul className="slds-has-dividers_bottom">
            {filteredTypes.map((type) => {
              const label = getMetadataLabelFromFullName(type);
              const comparability = getMetadataTypeComparability(type);
              return (
                <li key={type} className="slds-item slds-p-vertical_xx-small">
                  <Grid align="spread" verticalAlign="center">
                    <Checkbox
                      id={`org-alignment-type-${type}`}
                      label={
                        <span>
                          <strong>{label}</strong>
                          {label !== type && <span className="slds-text-color_weak slds-m-left_xx-small">({type})</span>}
                        </span>
                      }
                      checked={selectedSet.has(type)}
                      onChange={(checked) => toggleType(type, checked)}
                    />
                    {!comparability.comparable && (
                      <Tooltip id={`uncomparable-type-tip-${type}`} content={comparability.reason || 'Cannot be compared reliably'}>
                        <Badge type="light">Not Compared</Badge>
                      </Tooltip>
                    )}
                  </Grid>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
};

export default OrgAlignmentTypeSelectorModal;
