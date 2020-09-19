/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { Fragment } from 'react';
import Tabs from './Tabs';
import Icon from '../widgets/Icon';
import Grid from '../grid/Grid';
import GridCol from '../grid/GridCol';

export default {
  component: Tabs,
  title: 'Tabs',
};

export const base = () => (
  <Tabs
    tabs={[
      {
        id: 'Tab1',
        title: 'Tab One',
        content: 'This is my fancy tab 1!',
      },
      {
        id: 'Tab2',
        title: 'Tab Two',
        content: 'This is my fancy tab 2!',
      },
      {
        id: 'Tab3',
        title: (
          <strong>
            <span className="slds-tabs__left-icon">
              <Icon
                type="standard"
                icon="opportunity"
                containerClassname="lds-icon_container slds-icon-standard-opportunity"
                className="slds-icon slds-icon_small"
              />
            </span>
            <em>Tab</em> Three
          </strong>
        ),
        titleText: 'Tab 3 accessible hover title!',
        content: 'This is my fancy tab 3 has a custom title! Make sure to set {titleText} if title is not a string',
      },
    ]}
  />
);

export const vertical = () => (
  <Tabs
    position="vertical"
    tabs={[
      {
        id: 'Tab1',
        title: 'Tab One',
        content: 'This is my fancy tab 1!',
      },
      {
        id: 'Tab2',
        title: 'Tab Two',
        content: 'This is my fancy tab 2!',
      },
      {
        id: 'Tab3',
        title: (
          <Fragment>
            <span className="slds-vertical-tabs__left-icon">
              <Icon
                type="standard"
                icon="opportunity"
                containerClassname="lds-icon_container slds-icon-standard-opportunity"
                className="slds-icon slds-icon_small"
              />
            </span>
            <span className="slds-truncate" title="Tab Three">
              <em>Tab</em> Three
            </span>
            <span className="slds-vertical-tabs__right-icon">
              <Icon
                type="standard"
                icon="opportunity"
                containerClassname="lds-icon_container slds-icon-standard-opportunity"
                className="slds-icon slds-icon_small"
              />
            </span>
          </Fragment>
        ),
        titleText: 'Tab 3 accessible hover title!',
        content: 'This is my fancy tab 3 has a custom title! Make sure to set {titleText} if title is not a string',
      },
      {
        id: 'Tab4',
        title: (
          <Fragment>
            <span className="slds-vertical-tabs__left-icon"></span>
            <Grid vertical>
              <GridCol>Tab 4 content</GridCol>
              <GridCol className="slds-text-body_small slds-text-color_weak">Tab 4 subheading</GridCol>
            </Grid>
            <span className="slds-vertical-tabs__right-icon">
              <Icon
                type="standard"
                icon="opportunity"
                containerClassname="lds-icon_container slds-icon-standard-opportunity"
                className="slds-icon slds-icon_small"
              />
            </span>
          </Fragment>
        ),
        titleText: 'Tab 4 accessible hover title!',
        content: (
          <div className="slds-text-longform">
            <h3 className="slds-text-heading_medium">Tab Four Title</h3>
            <p>Content for Tab 1</p>
            <p>Lorem ipsum dolor...</p>
            <p>Lorem ipsum dolor...</p>
          </div>
        ),
      },
    ]}
  />
);
