import { Meta, Story } from '@storybook/react';
import React from 'react';
import Card, { CardProps } from './Card';

export default {
  title: 'Card',
  component: Card,
  argTypes: {
    actions: {
      name: 'Show Actions',
      control: {
        type: 'boolean',
      },
    },
    icon: {
      options: [
        'Activations',
        'AssetRelationship',
        'DataStreams',
        'Entity',
        'Feedback',
        'MultiPicklist',
        'Opportunity',
        'Portal',
        'Record',
        'RecordLookup',
        'RelatedList',
        'Settings',
      ],
      mapping: {
        Activations: { type: 'standard', icon: 'activations' },
        AssetRelationship: { type: 'standard', icon: 'asset_relationship' },
        DataStreams: { type: 'standard', icon: 'data_streams' },
        Entity: { type: 'standard', icon: 'entity' },
        Feedback: { type: 'standard', icon: 'feedback' },
        MultiPicklist: { type: 'standard', icon: 'multi_picklist' },
        Opportunity: { type: 'standard', icon: 'opportunity' },
        Portal: { type: 'standard', icon: 'portal' },
        Record: { type: 'standard', icon: 'record' },
        RecordLookup: { type: 'standard', icon: 'related_list' },
        RelatedList: { type: 'standard', icon: 'record_lookup' },
        Settings: { type: 'standard', icon: 'settings' },
      },
    },
  },
  args: {
    actions: true,
    icon: 'Opportunity',
    title: 'Card Title',
    footer: 'This is my card footer',
    children: 'This is a fancy card!',
  },
} as Meta;

const Template: Story<CardProps> = ({ actions, ...args }) => (
  <Card
    actions={
      actions ? (
        <div>
          <button className="slds-button slds-button_neutral">Edit</button>
          <button className="slds-button slds-button_brand">New</button>
        </div>
      ) : undefined
    }
    {...args}
  >
    {args.children}
  </Card>
);
export const BasicCard = Template.bind({});

export const CardWithCustomContent = Template.bind({});
CardWithCustomContent.argTypes = {
  title: { control: false },
  footer: { control: false },
  children: { control: false },
};
CardWithCustomContent.args = {
  title: (
    <span>
      My <strong>Strong</strong> Title
    </span>
  ),
  footer: (
    <span>
      My <strong>Strong</strong> Footer
    </span>
  ),
  children: (
    <span>
      My <strong>Strong</strong> Body
    </span>
  ),
};

export const NoHeaderOrFooter = Template.bind({});
NoHeaderOrFooter.args = {
  title: null,
  footer: null,
  actions: null,
};

export const LongTitle = Template.bind({});
LongTitle.args = {
  title:
    'titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle ',
};
