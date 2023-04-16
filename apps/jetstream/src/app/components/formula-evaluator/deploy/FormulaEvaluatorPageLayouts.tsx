import { css } from '@emotion/react';
import { useFetchPageLayouts } from '@jetstream/shared/ui-utils';
import { Checkbox, Grid, GridCol, ScopedNotification, Spinner } from '@jetstream/ui';

export interface FormulaEvaluatorPageLayoutsProps extends Omit<ReturnType<typeof useFetchPageLayouts>, 'layoutsByObject' | 'layoutsById'> {
  sobjectName: string;
  disabled: boolean;
}

export function FormulaEvaluatorPageLayouts({
  sobjectName,
  disabled,
  error,
  layouts,
  loading,
  selectedLayoutIds,
  handleSelectLayout,
  handleSelectAll,
}: FormulaEvaluatorPageLayoutsProps) {
  return (
    <Grid gutters wrap>
      {loading && <Spinner />}
      {error && (
        <GridCol size={12} className="slds-m-around-medium">
          <ScopedNotification theme="error" className="slds-m-top_medium">
            <p>{error}</p>
          </ScopedNotification>
        </GridCol>
      )}
      <GridCol size={12}>
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title={sobjectName}
            css={css`
              font-weight: 700;
            `}
          >
            {sobjectName}
          </legend>
          <Checkbox
            id={`layouts-select-all`}
            label="Select All"
            className="slds-m-bottom_xx-small"
            checked={selectedLayoutIds.size === layouts.length}
            disabled={disabled || loading}
            onChange={(value) => handleSelectAll(value)}
          />
          {layouts.map((layout) => (
            <Checkbox
              key={`layout-${layout.Id}`}
              id={`layout-${layout.Id}`}
              label={layout.Name}
              checked={selectedLayoutIds.has(layout.Id)}
              disabled={disabled || loading}
              onChange={(value) => handleSelectLayout(layout.Id)}
            />
          ))}
        </fieldset>
      </GridCol>
    </Grid>
  );
}

export default FormulaEvaluatorPageLayouts;
