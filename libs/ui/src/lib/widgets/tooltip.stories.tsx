import { Meta, Story } from '@storybook/react';
import React from 'react';
import Icon from './Icon';
import TooltipComponent, { TooltipProps } from './Tooltip';

export default {
  title: 'widgets/tooltip',
  component: TooltipComponent,
  args: {
    content: 'This is the tooltip content!',
    children: 'item with tooltip',
  },
} as Meta;

const Template: Story<TooltipProps> = ({ children, ...args }) => <TooltipComponent {...args}>{children}</TooltipComponent>;

export const Tooltip = Template.bind({});

export const TooltipFromIcon = Template.bind({});
TooltipFromIcon.argTypes = {
  children: {
    control: false,
  },
};
TooltipFromIcon.args = {
  children: <Icon type="utility" icon="settings" className="slds-icon slds-icon-text-default" />,
};

export const TooltipWithCustomContent = Template.bind({});
TooltipWithCustomContent.argTypes = {
  content: {
    control: false,
  },
};
TooltipWithCustomContent.args = {
  content: (
    <span style={{ fontSize: '1rem' }}>
      <strong>Fancy</strong> custom tooltip content!
    </span>
  ),
};
