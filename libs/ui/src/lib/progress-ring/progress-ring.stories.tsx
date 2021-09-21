import { Meta, Story } from '@storybook/react';
import React from 'react';
import Icon from '../widgets/Icon';
import Spinner from '../widgets/Spinner';
import ProgressRing, { ProgressRingProps } from './ProgressRing';

export default {
  component: ProgressRing,
  title: 'progress/ProgressRing',
  argTypes: {
    children: {
      control: false,
    },
    fillPercent: {
      control: { type: 'range', min: 0, max: 1, step: 0.05 },
    },
    size: {
      options: ['medium', 'large', 'x-large'],
    },
    theme: {
      options: ['none', 'active-step', 'warning', 'expired', 'complete'],
      mapping: {
        none: null,
        ['active-step']: 'active-step',
        warning: 'warning',
        expired: 'expired',
        complete: 'complete',
      },
    },
  },
  args: {
    fillPercent: 0.25,
    size: 'medium',
    theme: null,
  },
} as Meta;

const Template: Story<ProgressRingProps> = ({ children, ...args }) => <ProgressRing {...args}>{children}</ProgressRing>;

export const Base = Template.bind({});

export const WithIcon = Template.bind({});
WithIcon.args = {
  fillPercent: 0.75,
  children: <Icon type="utility" icon="warning" />,
};

export const WithText = Template.bind({});
WithText.args = {
  fillPercent: 0.45,
  children: <small>45%</small>,
};

export const WithTextComplete = Template.bind({});
WithTextComplete.args = {
  fillPercent: 1,
  theme: 'complete',
  size: 'x-large',
  children: <small>100%</small>,
};

export const WithSpinner = Template.bind({});
WithSpinner.args = {
  fillPercent: 0.45,
  size: 'x-large',
  theme: 'warning',
  children: <Spinner size="small" inline />,
};
