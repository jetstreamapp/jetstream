import { action } from '@storybook/addon-actions';
import { text, number, boolean, select } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React from 'react';
import AutoFullHeightContainer from './AutoFullHeightContainer';
import Header from './Header';
import Panel from './Panel';

export default {
  title: 'Layout',
};

export const autoFullHeightContainer = () => (
  <AutoFullHeightContainer
    className={text('className', undefined)}
    bottomBuffer={number('bottomBuffer', undefined)}
    fillHeigh={boolean('fillHeigh', true)}
  >
    <div>
      {new Array(100).fill(null, 0, 100).map((item, i) => (
        <div>item {i}</div>
      ))}
    </div>
  </AutoFullHeightContainer>
);

export const header = () => (
  <Header>
    <div>This is the content within the header</div>
  </Header>
);

export const panel = () => (
  <Panel
    heading={text('heading', 'My Panel Heading')}
    isOpen={boolean('isOpen', true)}
    size={select(
      'size',
      {
        sm: 'sm',
        md: 'md',
        lg: 'lg',
        xl: 'xl',
        full: 'full',
      },
      'lg'
    )}
    fullHeight={boolean('fullHeight', true)}
    position={select(
      'position',
      {
        left: 'left',
        right: 'right',
      },
      'left'
    )}
    onClosed={action('onClosed')}
  >
    <div>This is the content within the panel</div>
  </Panel>
);
