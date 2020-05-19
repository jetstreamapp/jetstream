import React from 'react';
import List from './List';
import uniqueId from 'lodash/uniqueId';
import { boolean } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';
import ToolbarItemActions from '../toolbar/ToolbarItemActions';

export default {
  title: 'List',
};

const activeItem = 5;
const activeItems = new Set([1, 3, 5, 6, 7, 8]);

const items = new Array(100).fill(null, 0, 100).map((item, i) => ({
  key: i,
  heading: `item ${i} heading`,
  subheading: `item ${i} subheading`,
}));

export const baseList = () => (
  <List
    items={items}
    useCheckbox={boolean('useCheckbox', false)}
    isActive={(item) => item.key === activeItem}
    onSelected={action('onSelected')}
    getContent={(item) => item}
  />
);

export const withoutSubheading = () => (
  <List
    items={items}
    useCheckbox={boolean('useCheckbox', false)}
    isActive={(item) => item.key === activeItem}
    onSelected={action('onSelected')}
    getContent={(item) => ({
      ...item,
      subheading: undefined,
    })}
  />
);

export const customContent = () => (
  <List
    items={items}
    useCheckbox={boolean('useCheckbox', false)}
    isActive={(item) => item.key === activeItem}
    onSelected={action('onSelected')}
    getContent={(item) => ({
      ...item,
      heading: (
        <div>
          <strong>{item.key}</strong> - {item.heading}
        </div>
      ),
      subheading: undefined,
    })}
  />
);

export const withCheckbox = () => (
  <List
    items={items}
    useCheckbox={boolean('useCheckbox', true)}
    isActive={(item) => activeItems.has(item.key)}
    onSelected={action('onSelected')}
    getContent={(item) => item}
  />
);

export const customContentWithCheckbox = () => (
  <List
    items={items}
    useCheckbox={boolean('useCheckbox', true)}
    isActive={(item) => item.key === activeItem}
    onSelected={action('onSelected')}
    getContent={(item) => ({
      ...item,
      heading: (
        <div>
          <strong>{item.key}</strong> - {item.heading}
        </div>
      ),
      subheading: undefined,
    })}
  />
);
