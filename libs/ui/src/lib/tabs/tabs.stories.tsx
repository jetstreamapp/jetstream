/* eslint-disable jsx-a11y/anchor-is-valid */
import React from 'react';
import Tabs from './Tabs';
import Icon from '../widgets/Icon';

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
