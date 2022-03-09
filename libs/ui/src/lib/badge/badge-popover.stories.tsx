import { Meta, Story } from '@storybook/react';
import React from 'react';
import BadgePopoverComponent, { BadgePopoverProps } from './BadgePopover';
import BadgePopoverGroupList from './BadgePopoverGroupList';
import BadgePopoverList from './BadgePopoverList';

export default {
  title: 'badge/badgePopover',
  component: BadgePopoverComponent,
  argTypes: {},
  args: {
    popoverTitle: 'This is my popover title',
    badgeLabel: 'My badge',
  },
} as Meta;

const Template: Story<BadgePopoverProps> = ({ children, ...args }) => <BadgePopoverComponent {...args}>{children}</BadgePopoverComponent>;

export const BadgePopover = Template.bind({});
BadgePopover.args = {
  children: [<div>Anything can go into the body of the popover</div>],
};

export const BadgeWithList = Template.bind({});
BadgeWithList.args = {
  badgeProps: {
    type: 'success',
  },
  children: [
    <BadgePopoverList
      items={[
        { id: 'item1', label: 'Apple', value: 'item1' },
        { id: 'item2', label: 'Banana', value: 'item2' },
        { id: 'item3', label: 'Item 3', value: 'item3' },
        { id: 'item4', label: 'Zoo', value: 'item4' },
        { id: 'item5', label: 'Zoo And Stuff', value: 'item5' },
        { id: 'item6', label: 'Foo', value: 'item6' },
        { id: 'item7', label: 'Bar', value: 'item7' },
        { id: 'item8', label: 'Item 8', value: 'item8' },
        { id: 'item9', label: 'Item 9', value: 'item9' },
        { id: 'item10', label: 'Item 10', value: 'item10' },
        { id: 'item11', label: 'Apple', value: 'item1' },
        { id: 'item12', label: 'Banana', value: 'item2' },
        { id: 'item13', label: 'Item 3', value: 'item3' },
        { id: 'item14', label: 'Zoo', value: 'item4' },
        { id: 'item15', label: 'Zoo And Stuff', value: 'item5' },
        { id: 'item16', label: 'Foo', value: 'item6' },
        { id: 'item17', label: 'Bar', value: 'item7' },
        { id: 'item18', label: 'Item 8', value: 'item8' },
        { id: 'item19', label: 'Item 9', value: 'item9' },
        { id: 'item20', label: 'Item 10', value: 'item10' },
        { id: 'item21', label: 'Apple', value: 'item1' },
        { id: 'item22', label: 'Banana', value: 'item2' },
        { id: 'item23', label: 'Item 3', value: 'item3' },
        { id: 'item24', label: 'Zoo', value: 'item4' },
        { id: 'item25', label: 'Zoo And Stuff', value: 'item5' },
        { id: 'item26', label: 'Foo', value: 'item6' },
        { id: 'item27', label: 'Bar', value: 'item7' },
        { id: 'item28', label: 'Item 8', value: 'item8' },
        { id: 'item29', label: 'Item 9', value: 'item9' },
        { id: 'item210', label: 'Item 10', value: 'item10' },
        { id: 'item211', label: 'Apple', value: 'item1' },
        { id: 'item212', label: 'Banana', value: 'item2' },
        { id: 'item213', label: 'Item 3', value: 'item3' },
        { id: 'item214', label: 'Zoo', value: 'item4' },
        { id: 'item215', label: 'Zoo And Stuff', value: 'item5' },
        { id: 'item216', label: 'Foo', value: 'item6' },
        { id: 'item217', label: 'Bar', value: 'item7' },
        { id: 'item218', label: 'Item 8', value: 'item8' },
        { id: 'item219', label: 'Item 9', value: 'item9' },
        { id: 'item220', label: 'Item 10', value: 'item10' },
      ]}
    />,
  ],
};

export const BadgeWithListAndClasses = Template.bind({});
BadgeWithListAndClasses.args = {
  badgeProps: {
    type: 'success',
  },
  children: [
    <BadgePopoverList
      liClassName="slds-item"
      onClick={(item) => console.log('clicked item', item)}
      items={[
        { id: 'item1', label: 'Apple', value: 'item1' },
        { id: 'item2', label: 'Banana', value: 'item2' },
        { id: 'item3', label: 'Item 3', value: 'item3' },
        { id: 'item4', label: 'Zoo', value: 'item4' },
        { id: 'item5', label: 'Zoo And Stuff', value: 'item5' },
        { id: 'item6', label: 'Foo', value: 'item6' },
        { id: 'item7', label: 'Bar', value: 'item7' },
        { id: 'item8', label: 'Item 8', value: 'item8' },
        { id: 'item9', label: 'Item 9', value: 'item9' },
        { id: 'item10', label: 'Item 10', value: 'item10' },
      ]}
    />,
  ],
};

export const BadgeWithListAndClassesReadOnly = Template.bind({});
BadgeWithListAndClassesReadOnly.args = {
  badgeProps: {
    type: 'warning',
  },
  children: [
    <BadgePopoverList
      liClassName="slds-item read-only"
      items={[
        { id: 'item1', label: 'Apple', value: 'item1' },
        { id: 'item2', label: 'Banana', value: 'item2' },
        { id: 'item3', label: 'Item 3', value: 'item3' },
        { id: 'item4', label: 'Zoo', value: 'item4' },
        { id: 'item5', label: 'Zoo And Stuff', value: 'item5' },
        { id: 'item6', label: 'Foo', value: 'item6' },
        { id: 'item7', label: 'Bar', value: 'item7' },
        { id: 'item8', label: 'Item 8', value: 'item8' },
        { id: 'item9', label: 'Item 9', value: 'item9' },
        { id: 'item10', label: 'Item 10', value: 'item10' },
      ]}
    />,
  ],
};

export const BadgeWithListGroup = Template.bind({});
BadgeWithListGroup.args = {
  type: 'error',
  children: [
    <BadgePopoverGroupList
      items={[
        {
          id: 'group1',
          label: 'Group 1',
          items: [
            { id: 'item1', label: 'Apple', value: 'item1' },
            { id: 'item2', label: 'Banana', value: 'item2' },
            { id: 'item3', label: 'Item 3', value: 'item3' },
            { id: 'item4', label: 'Zoo', value: 'item4' },
            { id: 'item5', label: 'Zoo And Stuff', value: 'item5' },
          ],
        },
        {
          id: 'group2',
          label: 'Group 2',
          items: [
            { id: 'item6', label: 'Foo', value: 'item6' },
            { id: 'item7', label: 'Bar', value: 'item7' },
            { id: 'item8', label: 'Item 8', value: 'item8' },
            { id: 'item9', label: 'Item 9', value: 'item9' },
            { id: 'item10', label: 'Item 10', value: 'item10' },
          ],
        },
        {
          id: 'group3',
          label: 'Group 3',
          items: [
            { id: 'item6', label: 'Foo', value: 'item6' },
            { id: 'item7', label: 'Bar', value: 'item7' },
            { id: 'item8', label: 'Item 8', value: 'item8' },
            { id: 'item9', label: 'Item 9', value: 'item9' },
            { id: 'item10', label: 'Item 10', value: 'item10' },
          ],
        },
      ]}
      emptyStateHeadline="There are no items to show! :D"
    />,
  ],
};
