import { Meta, Story } from '@storybook/react';
import React from 'react';
import IconComponent, { IconProps } from './Icon';
import { iconsWithType } from './icon-story.utils';

export default {
  title: 'widgets/Icon',
  component: IconComponent,
  argTypes: {
    type: {
      control: false,
    },
    icon: {
      options: iconsWithType,
    },
  },
  args: {
    icon: 'utility:info',
    omitContainer: false,
    className: 'slds-icon slds-icon-text-default',
    title: 'title for accessibility',
    description: 'description for accessibility',
  },
} as Meta;

const Template: Story<IconProps> = ({ icon: iconWithType, ...args }) => {
  const [type, icon] = iconWithType.split(':');
  return (
    <div className="slds-is-grid">
      <IconComponent type={type} icon={icon as any} {...args}></IconComponent>
    </div>
  );
};

export const Icon = Template.bind({});

export const IconWithCustomClass = Template.bind({});
IconWithCustomClass.args = {
  containerClassname: 'slds-icon-custom-custom5',
};

export const IconWithCircleContainer = Template.bind({});
IconWithCircleContainer.args = {
  icon: 'utility:settings',
  containerClassname: 'slds-icon_container_circle slds-icon-action-description',
};

export const IconSuccess = Template.bind({});
IconSuccess.args = {
  icon: 'utility:success',
  containerClassname: 'slds-icon_container slds-icon-utility-announcement',
  className: 'slds-icon slds-icon-text-success',
};
