import { Meta, Story } from '@storybook/react';
import React from 'react';
import BadgeComponent, { BadgeProps } from './Badge';
import Icon from '../widgets/Icon';

export default {
  title: 'badge/badge',
  component: BadgeComponent,
  argTypes: {
    children: {
      name: 'Content (children)',
    },
    type: {
      options: ['info', 'success', 'warning', 'error', 'offline', 'default', 'inverse', 'light'],
    },
    spanProps: {
      control: false,
    },
  },
  args: {
    title: 'cute badge :P',
    type: 'info',
    children: 'My Badge',
  },
} as Meta;

const Template: Story<BadgeProps> = ({ children, ...args }) => <BadgeComponent {...args}>{children}</BadgeComponent>;

export const Badge = Template.bind({});

export const BadgeWithLeftIcon = Template.bind({});
BadgeWithLeftIcon.args = {
  type: 'error',
  children: [
    <span className="slds-badge__icon slds-badge__icon_left">
      <Icon
        type="utility"
        icon="error"
        className="slds-icon slds-icon_xx-small"
        containerClassname="slds-icon_container slds-icon-utility-error"
      />
    </span>,
    'Badge With Left Icon',
  ],
};

export const BadgeWithRightIcon = Template.bind({});
BadgeWithRightIcon.args = {
  children: [
    'Badge With Right Icon',
    <span className="slds-badge__icon slds-badge__icon_right">
      <Icon
        type="utility"
        icon="moneybag"
        className="slds-icon slds-icon_xx-small"
        containerClassname="slds-icon_container slds-icon-utility-moneybag slds-current-color"
      />
    </span>,
  ],
};
