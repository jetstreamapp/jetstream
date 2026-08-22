import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Grid from '../grid/Grid';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import Icon from '../widgets/Icon';
import { ListOperatorSuggestion } from './expression-list-operator-utils';

export interface ExpressionListOperatorSuggestionsProps {
  suggestions: ListOperatorSuggestion[];
  onConvert: (suggestion: ListOperatorSuggestion) => void;
  onDismiss: (suggestion: ListOperatorSuggestion) => void;
}

/**
 * Offers to replace repeated conditions on the same field with a single In / Not In condition.
 * The light theme is deliberate - themed scoped notifications restyle bare neutral buttons.
 */
export const ExpressionListOperatorSuggestions: FunctionComponent<ExpressionListOperatorSuggestionsProps> = ({
  suggestions,
  onConvert,
  onDismiss,
}) => {
  if (!suggestions.length) {
    return null;
  }

  return (
    <ScopedNotification theme="light" className="slds-m-vertical_x-small">
      <ul>
        {suggestions.map((suggestion, index) => {
          const { id, resource, rowKeys, toOperatorLabel } = suggestion;
          const dismissLabel = `Dismiss suggestion for ${resource}`;
          return (
            <li key={id} className={classNames({ 'slds-m-top_xx-small': index > 0 })}>
              <Grid verticalAlign="center" align="spread" wrap>
                <span className="slds-m-right_small">
                  <strong>{resource}</strong>
                  {` appears in ${rowKeys.length} conditions that can be combined into one.`}
                </span>
                <Grid verticalAlign="center">
                  <button
                    type="button"
                    className="slds-button slds-button_neutral"
                    // every suggestion renders this button, so the field keeps the accessible names distinct
                    aria-label={`Use ${toOperatorLabel} operator for ${resource}`}
                    onClick={() => onConvert(suggestion)}
                  >
                    {`Use ${toOperatorLabel} operator`}
                  </button>
                  <button
                    type="button"
                    className="slds-button slds-button_icon slds-button_icon-small slds-m-left_xx-small"
                    title={dismissLabel}
                    onClick={() => onDismiss(suggestion)}
                  >
                    <Icon type="utility" icon="close" omitContainer className="slds-button__icon" />
                    <span className="slds-assistive-text">{dismissLabel}</span>
                  </button>
                </Grid>
              </Grid>
            </li>
          );
        })}
      </ul>
    </ScopedNotification>
  );
};

export default ExpressionListOperatorSuggestions;
