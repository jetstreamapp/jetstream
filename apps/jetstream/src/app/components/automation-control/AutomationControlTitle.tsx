/** @jsx jsx */
import { jsx } from '@emotion/react';
import { Grid, GridCol, useHighlightedText } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { AutomationControlMetadataType, AutomationControlParentSobject } from './automation-control-types';

export interface AutomationControlTabTitleProps {
  item: AutomationControlParentSobject;
  searchTerm?: string;
}

function getModifiedItemsText(item: AutomationControlParentSobject) {
  const modifiedItemCount = Object.values(item.automationItems).flatMap((childItem: AutomationControlMetadataType) =>
    childItem.items.filter(
      (currItem) => currItem.currentValue !== currItem.initialValue || currItem.currentActiveVersion !== currItem.initialActiveVersion
    )
  ).length;
  if (modifiedItemCount) {
    return <span className="slds-badge slds-badge_inverse">{modifiedItemCount}</span>;
  } else {
    return '';
  }
}

export const AutomationControlTabTitle: FunctionComponent<AutomationControlTabTitleProps> = ({ item, searchTerm }) => {
  const sobjectLabel = useHighlightedText(item.sobjectLabel, searchTerm);
  const sobjectName = useHighlightedText(item.sobjectName, searchTerm);
  return (
    <Fragment>
      <span className="slds-vertical-tabs__left-icon"></span>
      <span className="slds-truncate" title={item.sobjectLabel}></span>
      <Grid vertical>
        <GridCol>
          <span title={item.sobjectLabel}>{sobjectLabel}</span>
        </GridCol>
        <GridCol>
          <span className="slds-text-body_small slds-text-color_weak slds-truncate" title={item.sobjectName}>
            {sobjectName}
          </span>
        </GridCol>
      </Grid>
      <span className="slds-vertical-tabs__right-icon">{getModifiedItemsText(item)}</span>
    </Fragment>
  );
};
