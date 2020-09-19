/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Accordion, Checkbox, Grid, GridCol } from '@jetstream/ui';
import { Fragment, FunctionComponent, useState } from 'react';
import { AutomationControlParentSobject } from './temp-types';

interface AutomationControlTabContentProps {
  item: AutomationControlParentSobject;
  isActive: boolean; // TODO: do I need this?
}

export interface AutomationControlTabTitleProps {
  item: AutomationControlParentSobject;
  isActive: boolean; // TODO: do I need this?
}

function getModifiedItemsText(item: AutomationControlParentSobject) {
  const modifiedItemCount = Object.values(item.automationItems).flatMap((childItem) =>
    childItem.items.filter((currItem) => currItem.currentValue !== currItem.initialValue)
  ).length;
  if (modifiedItemCount) {
    return <span className="slds-badge slds-badge_inverse">{modifiedItemCount}</span>;
  } else {
    return '';
  }
}

export const AutomationControlTabTitle: FunctionComponent<AutomationControlTabTitleProps> = ({ item, isActive }) => {
  return (
    <Fragment>
      <span className="slds-vertical-tabs__left-icon"></span>
      <span className="slds-truncate" title={item.sobjectLabel}></span>
      <Grid vertical>
        <GridCol>
          <span title={item.sobjectLabel}>{item.sobjectLabel}</span>
        </GridCol>
        <GridCol>
          <span className="slds-text-body_small slds-text-color_weak slds-truncate" title={item.sobjectName}>
            {item.sobjectName}
          </span>
        </GridCol>
      </Grid>
      <span className="slds-vertical-tabs__right-icon">
        {/* TODO: loading / status / etc.. */}
        {/* <Icon
        type="standard"
        icon="opportunity"
        containerClassname="lds-icon_container slds-icon-standard-opportunity"
        className="slds-icon slds-icon_small"
      /> */}
        {getModifiedItemsText(item)}
      </span>
    </Fragment>
  );
};
