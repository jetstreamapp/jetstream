/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Grid, Icon, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { AutomationControlMetadataType, AutomationControlMetadataTypeItem } from '../automation-control-types';

interface AutomationControlContentContainerProps {
  parentItem: AutomationControlMetadataType;
  items: AutomationControlMetadataTypeItem[];
}

export const AutomationControlContentContainer: FunctionComponent<AutomationControlContentContainerProps> = ({
  parentItem,
  items,
  children,
}) => {
  const isLoading = parentItem.loading && !parentItem.errorMessage;
  const hasError = parentItem.errorMessage;
  const hasItems = items && items.length;
  const showNoItems = !isLoading && !hasError && !hasItems;
  const showItems = !isLoading && !hasError && hasItems;
  return (
    <Fragment>
      {showNoItems && 'No items to display'}
      {isLoading && (
        <span
          className="slds-is-relative"
          css={css`
            margin-left: 50px;
            margin-top: 25px;
            display: inline-block;
            min-height: 25px;
          `}
        >
          <Spinner inline />
        </span>
      )}
      {hasError && (
        <Grid className="slds-inline_icon_text slds-m-left_medium">
          <Icon
            type="utility"
            icon="error"
            className="slds-icon slds-icon_x-small slds-m-right_xx-small slds-icon-text-error"
            containerClassname="slds-icon_container slds-icon-utility-error"
          />
          <div className="slds-col slds-align-middle slds-text-color_error">{parentItem.errorMessage}</div>
        </Grid>
      )}
      {showItems && children}
    </Fragment>
  );
};

export default AutomationControlContentContainer;
