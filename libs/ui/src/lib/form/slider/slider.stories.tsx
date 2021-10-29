import { Meta, Story } from '@storybook/react';
import React from 'react';
import SliderComponent, { SliderProps } from './Slider';

export default {
  component: SliderComponent,
  title: 'forms/Slider',
  argTypes: {
    items: { control: false },
    size: {
      options: ['x-small', 'small', 'medium', 'large'],
    },
    onChange: { action: 'onChange' },
  },
  args: {
    label: 'Slider',
    rangeLabel: '0 - 500',
    min: 0,
    max: 500,
    step: 10,
    value: '50',
  },
} as Meta;

const Template: Story<SliderProps> = ({ ...args }) => <SliderComponent {...args} />;

export const Slider = Template.bind({});
