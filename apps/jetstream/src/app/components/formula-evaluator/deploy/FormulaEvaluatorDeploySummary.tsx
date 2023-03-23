import { css } from '@emotion/react';
import { useProfilesAndPermSets } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Grid, GridCol, ScopedNotification } from '@jetstream/ui';
import { FieldValues } from '../../shared/create-fields/create-fields-types';

export interface FormulaEvaluatorDeploySummaryProps {
  field: FieldValues;
  selectedProfiles: string[];
  selectedPermissionSets: string[];
  selectedLayouts: string[];
  error?: Maybe<string>;
}

export function FormulaEvaluatorDeploySummary({
  field,
  selectedProfiles,
  selectedPermissionSets,
  selectedLayouts,
  error,
}: FormulaEvaluatorDeploySummaryProps) {
  return (
    <Grid gutters wrap>
      {error && (
        <GridCol size={12} className="slds-m-around-medium">
          <ScopedNotification theme="error" className="slds-m-top_medium">
            <p>{error}</p>
          </ScopedNotification>
        </GridCol>
      )}

      {/* Show summary of field, permissions, layouts */}
      <GridCol className="slds-m-around-medium">
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title="Field"
            css={css`
              font-weight: 700;
            `}
          >
            Field
          </legend>
          {field.label.value} ({field.fullName.value})
        </fieldset>
      </GridCol>
      <GridCol className="slds-m-around-medium">
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title="Field"
            css={css`
              font-weight: 700;
            `}
          >
            Permissions
          </legend>
          <ul>
            {selectedProfiles.map((item) => (
              <li key={item}>{item} (Profile)</li>
            ))}
          </ul>
          <ul>
            {selectedPermissionSets.map((item) => (
              <li key={item}>{item} (Permission Set)</li>
            ))}
          </ul>
        </fieldset>
      </GridCol>
      <GridCol className="slds-m-around-medium">
        <fieldset className="slds-form-element slds-m-top_small">
          <legend
            className="slds-form-element__label slds-truncate"
            title="Field"
            css={css`
              font-weight: 700;
            `}
          >
            Layouts
          </legend>
          <ul>
            {selectedLayouts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </fieldset>
      </GridCol>
    </Grid>
  );
}

export default FormulaEvaluatorDeploySummary;
