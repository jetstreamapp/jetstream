/* eslint-disable jsx-a11y/anchor-is-valid */
import { text } from '@storybook/addon-knobs';
import Icon from 'libs/ui/src/lib/widgets/Icon';
import { cloneDeep } from 'lodash';
import React from 'react';
import Tree, { TreeItems } from './Tree';

export default {
  component: Tree,
  title: 'Tree',
};

const tree: TreeItems[] = [
  {
    id: '1',
    label: 'Tree Item 1',
    treeItems: [
      {
        id: '1-1',
        label: 'Nested item 1',
        treeItems: [],
      },
      {
        id: '1-2',
        label: 'Nested item 2',
        treeItems: [
          {
            id: '1-2-1',
            label: 'Nested, Nested item 1',
            treeItems: [],
          },
        ],
      },
    ],
  },
  {
    id: '2',
    label: 'Tree Item 2',
  },
  {
    id: '3',
    label: 'Tree Item 3',
    treeItems: [
      {
        id: '3-1',
        label: 'Nested item 3-1',
        treeItems: [],
      },
      {
        id: '3-2',
        label: 'Nested item 3-2',
        treeItems: [
          {
            id: '3-2-1',
            label: 'Nested, Nested item 3',
            treeItems: [],
          },
        ],
      },
    ],
  },
];

export const base = () => <Tree header={text('header', 'My Tree')} items={tree} />;

const tree2 = cloneDeep(tree);

tree2[1].label = (
  <div className="">
    <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small" /> This is my custom Component
  </div>
);

export const customContent = () => <Tree header={text('header', 'My Tree')} items={tree2} />;
