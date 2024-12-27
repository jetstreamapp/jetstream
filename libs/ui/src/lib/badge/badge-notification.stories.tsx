import { Meta, StoryFn } from '@storybook/react';
import Icon from '../widgets/Icon';
import BadgeNotificationComponent, { BadgeNotificationProps } from './BadgeNotification';

export default {
  title: 'badge/badgeNotification',
  component: BadgeNotificationComponent,
  args: {
    animate: true,
    children: '2',
  },
} as Meta;

const Template: StoryFn<BadgeNotificationProps> = ({ children, ...args }) => (
  <button className="slds-button slds-button_icon">
    <BadgeNotificationComponent {...args}>{children}</BadgeNotificationComponent>
    <Icon type="utility" icon="notification" className="slds-button__icon slds-button__icon_large" omitContainer />
  </button>
);

export const Badge = Template.bind({});

export const BadgeWithNoAnimate = Template.bind({});
BadgeWithNoAnimate.args = {
  animate: false,
  children: undefined,
};
