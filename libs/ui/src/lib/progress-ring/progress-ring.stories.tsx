import { action } from '@storybook/addon-actions';
import { boolean, number, select, text } from '@storybook/addon-knobs';
import Icon from '../widgets/Icon';
import React from 'react';
import ProgressRing from './ProgressRing';

export default {
  component: ProgressRing,
  title: 'ProgressRing',
};

export const base = () => (
  <ProgressRing
    className={text('className', undefined)}
    fillPercent={number('current', 0.25)}
    size={select(
      'size',
      {
        Medium: 'medium',
        Large: 'large',
        XLarge: 'x-large',
      },
      'medium'
    )}
    theme={select(
      'theme',
      {
        None: undefined,
        ActiveStep: 'active-step',
        Warning: 'warning',
        Expired: 'expired',
        Complete: 'complete',
      },
      undefined
    )}
  ></ProgressRing>
);

export const withIcon = () => (
  <ProgressRing
    className={text('className', undefined)}
    fillPercent={number('current', 0.75)}
    size={select(
      'size',
      {
        Medium: 'medium',
        Large: 'large',
        XLarge: 'x-large',
      },
      'large'
    )}
    theme={select(
      'theme',
      {
        None: undefined,
        ActiveStep: 'active-step',
        Warning: 'warning',
        Expired: 'expired',
        Complete: 'complete',
      },
      'warning'
    )}
  >
    <Icon type="utility" icon="warning" />
  </ProgressRing>
);

export const withText = () => (
  <ProgressRing
    className={text('className', undefined)}
    fillPercent={number('current', 0.45)}
    size={select(
      'size',
      {
        Medium: 'medium',
        Large: 'large',
        XLarge: 'x-large',
      },
      'x-large'
    )}
    theme={select(
      'theme',
      {
        None: undefined,
        ActiveStep: 'active-step',
        Warning: 'warning',
        Expired: 'expired',
        Complete: 'complete',
      },
      'warning'
    )}
  >
    <small>45%</small>
  </ProgressRing>
);
