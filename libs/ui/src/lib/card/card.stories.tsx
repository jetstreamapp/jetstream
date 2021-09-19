import React from 'react';
import Card from './Card';

export default {
  title: 'Card',
  component: Card,
};

export const card = () => (
  <Card
    title="my card title"
    icon={{ type: 'standard', icon: 'opportunity', description: 'Account' }}
    actions={<button className="slds-button slds-button_neutral">New</button>}
    footer="This is a footer"
  >
    Foo
  </Card>
);

export const cardWithCustomContent = () => (
  <Card
    title={
      <span>
        My <strong>Strong</strong> Title
      </span>
    }
    icon={{ type: 'standard', icon: 'opportunity', description: 'Account' }}
    actions={<button className="slds-button slds-button_neutral">New</button>}
    footer={
      <span>
        My <strong>Strong</strong> Footer
      </span>
    }
  >
    Foo
  </Card>
);

export const NoHeaderOrFooter = () => <Card>Foo</Card>;

export const LongTitle = () => (
  <Card title="titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle titletitletitletitletitletitletitletitletitletitle ">
    {' '}
    Foo
  </Card>
);
