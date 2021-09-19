import { Icon } from './Icon';
import { Meta, Story } from '@storybook/react';
import React from 'react';
import HelpTextComponent, { HelpTextProps } from './HelpText';

export default {
  title: 'widgets/helpText',
  component: HelpTextComponent,
  argTypes: {
    onRemove: { action: 'clicked' },
  },
  args: {
    content: 'My Pill',
  },
} as Meta;

const Template: Story<HelpTextProps> = ({ ...args }) => <HelpTextComponent {...args} />;

export const HelpText = Template.bind({});

export const HelpTextWithCustomContent = Template.bind({});
HelpTextWithCustomContent.argTypes = {
  content: {
    control: false,
  },
};
HelpTextWithCustomContent.args = {
  content: (
    <div>
      <Icon type="utility" icon="settings" className="slds-icon slds-icon_xx-small" />
      <strong>Custom</strong> content!
    </div>
  ),
};
