import { css } from '@emotion/react';
import { isEnterKey } from '@jetstream/shared/ui-utils';
import { DuelingPicklist, DuelingPicklistItem, Input } from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';
import { parseFeatures } from '../scratch-org-definition.utils';
import {
  compareFeatureNames,
  formatScratchOrgFeature,
  getKnownScratchOrgFeature,
  getScratchOrgFeatureKey,
  KNOWN_SCRATCH_ORG_FEATURES,
  parseScratchOrgFeature,
  ScratchOrgFeatureEntry,
} from '../scratch-org-features';

const VALUE_INPUT_STYLES = css`
  width: 8rem;
`;

export interface ScratchOrgFeaturesInputProps {
  id: string;
  /** Features as they are written in a definition file, e.g. `Communities` or `MaxApexCodeSize:10` */
  features: string[];
  disabled?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onChange: (features: string[]) => void;
}

/**
 * Pick scratch org features from the documented list, with room for features that are not on it:
 * Salesforce adds features every release, so anything typed in is accepted and validated by the Dev Hub.
 */
export const ScratchOrgFeaturesInput: FunctionComponent<ScratchOrgFeaturesInputProps> = ({
  id,
  features,
  disabled,
  hasError,
  errorMessage,
  onChange,
}) => {
  const [customFeatures, setCustomFeatures] = useState('');

  const entries = useMemo(
    () => features.map(parseScratchOrgFeature).sort((entryA, entryB) => compareFeatureNames(entryA.name, entryB.name)),
    [features],
  );

  const { entriesByKey, items, selectedItems, entriesWithValue } = useMemo(() => {
    const entriesByKey = new Map(entries.map((entry) => [getScratchOrgFeatureKey(entry.name), entry]));
    const knownItems = KNOWN_SCRATCH_ORG_FEATURES.map(({ name, requiresValue }): DuelingPicklistItem => {
      const selectedEntry = entriesByKey.get(getScratchOrgFeatureKey(name));
      const availableLabel = requiresValue ? `${name}:VALUE` : name;
      return { value: getScratchOrgFeatureKey(name), label: selectedEntry ? formatScratchOrgFeature(selectedEntry) : availableLabel };
    });
    // Features that are not documented only exist while they are selected
    const customItems = entries
      .filter(({ name }) => !getKnownScratchOrgFeature(name))
      .map((entry): DuelingPicklistItem => ({ value: getScratchOrgFeatureKey(entry.name), label: formatScratchOrgFeature(entry) }));
    return {
      entriesByKey,
      items: [...knownItems, ...customItems],
      selectedItems: Array.from(entriesByKey.keys()),
      entriesWithValue: entries.filter(({ name, value }) => value !== null || getKnownScratchOrgFeature(name)?.requiresValue),
    };
  }, [entries]);

  function handleSelectionChange(keys: string[]) {
    onChange(
      keys.map((key) => {
        const existingEntry = entriesByKey.get(key);
        if (existingEntry) {
          return formatScratchOrgFeature(existingEntry);
        }
        const knownFeature = getKnownScratchOrgFeature(key);
        return formatScratchOrgFeature({ name: knownFeature?.name ?? key, value: knownFeature?.requiresValue ? '' : null });
      }),
    );
  }

  function handleValueChange({ name }: ScratchOrgFeatureEntry, value: string) {
    onChange(entries.map((entry) => formatScratchOrgFeature(entry.name === name ? { ...entry, value } : entry)));
  }

  function handleAddCustomFeatures() {
    const updatedEntriesByKey = new Map(entriesByKey);
    parseFeatures(customFeatures)
      .map(parseScratchOrgFeature)
      .filter(({ name }) => !!name)
      .forEach((entry) => {
        const key = getScratchOrgFeatureKey(entry.name);
        // Adding a feature again only replaces it when that changes its value
        if (!updatedEntriesByKey.has(key) || entry.value !== null) {
          updatedEntriesByKey.set(key, entry);
        }
      });
    onChange(Array.from(updatedEntriesByKey.values()).map(formatScratchOrgFeature));
    setCustomFeatures('');
  }

  return (
    <div>
      <DuelingPicklist
        id={id}
        label="Features"
        labelHelp="Add-on features to enable in the scratch org. Double-click a feature or use the arrows to move it."
        labelLeft="Available"
        labelRight="Selected"
        omitReorder
        isResponsive
        allowFilter
        filterPlaceholder="Filter features"
        emptySelectionMessage="No features selected"
        disabled={disabled}
        hasError={hasError}
        errorMessage={errorMessage}
        items={items}
        selectedItems={selectedItems}
        onChange={handleSelectionChange}
      />

      {!!entriesWithValue.length && (
        <fieldset className="slds-form-element slds-m-top_x-small">
          <legend className="slds-form-element__label">Feature Values</legend>
          {entriesWithValue.map((entry) => {
            const inputId = `${id}-value-${getScratchOrgFeatureKey(entry.name)}`;
            const knownFeature = getKnownScratchOrgFeature(entry.name);
            return (
              <div key={entry.name} className="slds-grid slds-grid_vertical-align-center slds-m-bottom_xx-small">
                <label className="slds-col slds-truncate slds-m-right_small" htmlFor={inputId} title={entry.name}>
                  {knownFeature?.requiresValue && (
                    <abbr className="slds-required" title="required">
                      *{' '}
                    </abbr>
                  )}
                  {entry.name}
                </label>
                <input
                  id={inputId}
                  className="slds-input slds-no-flex"
                  css={VALUE_INPUT_STYLES}
                  inputMode="numeric"
                  value={entry.value ?? ''}
                  placeholder={knownFeature?.valueHint}
                  title={knownFeature?.valueHint ? `Supported values: ${knownFeature.valueHint}` : undefined}
                  disabled={disabled}
                  autoComplete="off"
                  onChange={(event) => handleValueChange(entry, event.target.value.trim())}
                />
              </div>
            );
          })}
        </fieldset>
      )}

      <div className="slds-grid slds-grid_vertical-align-end slds-m-top_x-small">
        <Input
          id={`${id}-custom`}
          className="slds-col"
          label="Other Features"
          labelHelp="Add features that are not in the list, Salesforce adds new ones every release. Separate features with a comma and use Feature:10 for a feature with a value."
        >
          <input
            id={`${id}-custom`}
            className="slds-input"
            value={customFeatures}
            placeholder="FeatureName, FeatureWithValue:10"
            disabled={disabled}
            autoComplete="off"
            onChange={(event) => setCustomFeatures(event.target.value)}
            onKeyDown={(event) => {
              // Enter would otherwise submit the whole form
              if (isEnterKey(event)) {
                event.preventDefault();
                handleAddCustomFeatures();
              }
            }}
          />
        </Input>
        <button
          type="button"
          className="slds-button slds-button_neutral slds-m-left_x-small"
          disabled={disabled || !customFeatures.trim()}
          onClick={handleAddCustomFeatures}
        >
          Add
        </button>
      </div>
    </div>
  );
};
