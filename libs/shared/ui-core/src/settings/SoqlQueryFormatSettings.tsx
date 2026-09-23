import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SoqlQueryFormatOptions, SoqlQueryFormatOptionsSchema } from '@jetstream/types';
import { formatQuery } from '@jetstreamapp/soql-parser-js';
import isEqual from 'lodash/isEqual';
import { useState } from 'react';
import { useAmplitude } from '../analytics';
import { getSettingsRowIds, SettingsGroup, SettingsRow, SettingsToggleRow } from './layout/SettingsSection';

const PREVIEW_QUERY =
  "SELECT Id, Name, Industry, AnnualRevenue, Owner.Name, (SELECT Id, FirstName, LastName, Email FROM Contacts WHERE Email != NULL) FROM Account WHERE Industry = 'Technology' AND (AnnualRevenue > 1000000 OR NumberOfEmployees > 500) ORDER BY Name LIMIT 50";

const DEFAULT_OPTIONS = SoqlQueryFormatOptionsSchema.parse({});

type NumericOption = 'fieldMaxLineLength' | 'numIndent';

const columnsCss = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);

  @media (max-width: 64em) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const optionsCss = css`
  & > * + * {
    border-top: 1px solid var(--slds-g-color-border-1, #e5e5e5);
  }
`;

const previewColumnCss = css`
  margin: 0;
  padding: 0.875rem 1.25rem;
  border-left: 1px solid var(--slds-g-color-border-1, #e5e5e5);

  @media (max-width: 64em) {
    border-left: none;
    border-top: 1px solid var(--slds-g-color-border-1, #e5e5e5);
  }
`;

const previewCss = css`
  margin: 0.5rem 0 0;
  padding: 0.75rem;
  overflow-x: auto;
  border-radius: 0.25rem;
  background-color: var(--slds-g-color-surface-container-2, #f3f3f3);
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre;
  /* The formatter indents with tabs - match the query editor's tab width */
  tab-size: 4;
`;

const numberInputCss = css`
  width: 5rem;
`;

function formatPreview(options: SoqlQueryFormatOptions) {
  try {
    return formatQuery(PREVIEW_QUERY, options);
  } catch {
    return PREVIEW_QUERY;
  }
}

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

export interface SoqlQueryFormatSettingsProps {
  /** Location string for analytics purposes */
  location?: string;
  value: SoqlQueryFormatOptions;
  onChange: (value: SoqlQueryFormatOptions) => void;
}

/**
 * SOQL format options for the settings page. Unlike `SoqlQueryFormatConfig` (used in popovers), every
 * change is saved immediately like the rest of the settings page, and a preview shows the result.
 */
export const SoqlQueryFormatSettings = ({ location = 'Settings', value, onChange }: SoqlQueryFormatSettingsProps) => {
  const { trackEvent } = useAmplitude();
  // What is being typed into a number field (kept as a string so it can be cleared), until it is committed on blur
  const [numericDrafts, setNumericDrafts] = useState<Partial<Record<NumericOption, string>>>({});
  const getNumericInput = (option: NumericOption) => numericDrafts[option] ?? String(value[option]);

  const isDefault = isEqual(value, DEFAULT_OPTIONS);

  // Previews what is typed before it is saved, so the effect of a number is visible while choosing it
  const preview = formatPreview({
    ...value,
    fieldMaxLineLength: parsePositiveInteger(getNumericInput('fieldMaxLineLength')) ?? value.fieldMaxLineLength,
    numIndent: parsePositiveInteger(getNumericInput('numIndent')) ?? value.numIndent,
  });

  function save(updatedValue: SoqlQueryFormatOptions) {
    if (isEqual(updatedValue, value)) {
      return;
    }
    onChange(updatedValue);
    trackEvent(ANALYTICS_KEYS.soql_format_saved, { location, values: updatedValue });
  }

  /** Saves a valid draft - an invalid one is dropped, which puts the saved value back in the field */
  function commitNumericOption(option: NumericOption) {
    const draft = numericDrafts[option];
    setNumericDrafts(({ [option]: _committed, ...remainingDrafts }) => remainingDrafts);
    const parsed = draft === undefined ? null : parsePositiveInteger(draft);
    if (parsed !== null) {
      save({ ...value, [option]: parsed });
    }
  }

  function handleResetToDefaults() {
    setNumericDrafts({});
    save(DEFAULT_OPTIONS);
    trackEvent(ANALYTICS_KEYS.soql_format_reset, { location, values: value });
  }

  function renderNumericRow(option: NumericOption, title: string, description: string) {
    const inputId = `setting-soql-format-${option}`;
    const rowId = `${inputId}-row`;
    const errorId = `${inputId}-error`;
    const isValid = parsePositiveInteger(getNumericInput(option)) !== null;
    const { descriptionId } = getSettingsRowIds(rowId);
    return (
      <SettingsRow
        id={rowId}
        title={title}
        labelFor={inputId}
        description={description}
        details={
          !isValid && (
            <span id={errorId} className="slds-text-color_error">
              Enter a whole number of 1 or more
            </span>
          )
        }
      >
        <div className={isValid ? 'slds-form-element' : 'slds-form-element slds-has-error'}>
          <input
            id={inputId}
            className="slds-input"
            css={numberInputCss}
            type="number"
            min={1}
            step={1}
            value={getNumericInput(option)}
            aria-invalid={!isValid}
            aria-describedby={isValid ? descriptionId : `${descriptionId} ${errorId}`}
            onChange={(event) => {
              const inputValue = event.target.value;
              setNumericDrafts((prior) => ({ ...prior, [option]: inputValue }));
            }}
            onBlur={() => commitNumericOption(option)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitNumericOption(option);
              }
            }}
          />
        </div>
      </SettingsRow>
    );
  }

  return (
    <SettingsGroup
      title="SOQL formatting"
      description="Used whenever Jetstream writes or formats a query, such as the SOQL built by the Query Builder."
      actions={
        !isDefault && (
          <button className="slds-button" onClick={handleResetToDefaults}>
            Reset to Defaults
          </button>
        )
      }
    >
      <div css={columnsCss}>
        <div css={optionsCss}>
          {renderNumericRow(
            'fieldMaxLineLength',
            'Max characters per line',
            'Fields wrap once a line reaches this length. Use 1 to put each field on its own line.',
          )}
          {renderNumericRow('numIndent', 'Indent size', 'Number of tabs for each level of indentation.')}
          <SettingsToggleRow
            id="setting-soql-format-new-line-after-keywords"
            title="New line after keywords"
            description="Put SELECT, FROM, WHERE and other keywords on their own line."
            checked={value.newLineAfterKeywords}
            onChange={(newLineAfterKeywords) => save({ ...value, newLineAfterKeywords })}
          />
          <SettingsToggleRow
            id="setting-soql-format-where-operators-indented"
            title="Indent WHERE clause operators"
            description="Start each AND / OR condition on its own indented line."
            checked={value.whereClauseOperatorsIndented}
            onChange={(whereClauseOperatorsIndented) => save({ ...value, whereClauseOperatorsIndented })}
          />
          <SettingsToggleRow
            id="setting-soql-format-subquery-parens"
            title="Subquery parentheses on own line"
            description="Put the opening and closing parentheses of subqueries on their own lines."
            checked={value.fieldSubqueryParensOnOwnLine}
            onChange={(fieldSubqueryParensOnOwnLine) => save({ ...value, fieldSubqueryParensOnOwnLine })}
          />
        </div>
        <figure css={previewColumnCss}>
          <figcaption className="slds-text-title_caps">Preview</figcaption>
          <pre css={previewCss} data-testid="soql-format-preview">
            {preview}
          </pre>
        </figure>
      </div>
    </SettingsGroup>
  );
};
