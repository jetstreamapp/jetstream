import { Meta, Story } from '@storybook/react';
import React from 'react';
import Icon, { IconProps } from './Icon';
import { iconsWithType } from './icon-story.utils';

export default {
  title: 'widgets/Icon',
  component: Icon,
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
      <Icon type={type} icon={icon as any} {...args}></Icon>
    </div>
  );
};

const ButtonIconTemplate: Story<IconProps & { buttonClass?: string }> = ({ buttonClass, icon: iconWithType, ...args }) => {
  const [type, icon] = iconWithType.split(':');
  buttonClass = buttonClass || 'slds-button slds-button_icon';
  return (
    <button className={buttonClass}>
      <Icon type={type} icon={icon as any} {...args}></Icon>
    </button>
  );
};

export const BaseIcon = Template.bind({});

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

export const ButtonIcon = ButtonIconTemplate.bind({});
ButtonIcon.args = {
  // ButtonIconTemplate: '',
  icon: 'utility:settings',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconBrand = ButtonIconTemplate.bind({});
ButtonIconBrand.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-brand',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconContainerBare = ButtonIconTemplate.bind({});
ButtonIconContainerBare.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-container',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconContainerFilled = ButtonIconTemplate.bind({});
ButtonIconContainerFilled.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-border-filled',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconContainerBorder = ButtonIconTemplate.bind({});
ButtonIconContainerBorder.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-border',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconLarge = ButtonIconTemplate.bind({});
ButtonIconLarge.args = {
  buttonClass: 'slds-button slds-button_icon',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon slds-button__icon_large',
};

export const ButtonIconSmall = ButtonIconTemplate.bind({});
ButtonIconSmall.args = {
  buttonClass: 'slds-button slds-button_icon',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon slds-button__icon_small',
};

export const ButtonIconXSmall = ButtonIconTemplate.bind({});
ButtonIconXSmall.args = {
  buttonClass: 'slds-button slds-button_icon',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon slds-button__icon_x-small',
};

export const ButtonIconContainerSmall = ButtonIconTemplate.bind({});
ButtonIconContainerSmall.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-border slds-button_icon-small',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconContainerXSmall = ButtonIconTemplate.bind({});
ButtonIconContainerXSmall.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-border slds-button_icon-x-small',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconContainerXXSmall = ButtonIconTemplate.bind({});
ButtonIconContainerXXSmall.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-border slds-button_icon-xx-small',
  icon: 'utility:search',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconError = ButtonIconTemplate.bind({});
ButtonIconError.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-error',
  icon: 'utility:error',
  omitContainer: true,
  className: 'slds-button__icon',
};

export const ButtonIconWarning = ButtonIconTemplate.bind({});
ButtonIconWarning.args = {
  buttonClass: 'slds-button slds-button_icon slds-button_icon-warning',
  icon: 'utility:warning',
  omitContainer: true,
  className: 'slds-button__icon',
};
