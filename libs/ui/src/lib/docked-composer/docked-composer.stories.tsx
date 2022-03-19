import DockedComposer, { DockedComposerProps } from './DockedComposer';
import { Story, Meta } from '@storybook/react';

export default {
  title: 'DockedComposer',
  component: DockedComposer,
  args: {
    label: 'Test Composer',
    iconOverride: null,
    initOpenState: true,
    allowMinimize: true,
  },
} as Meta;

const Template: Story<DockedComposerProps> = (args) => (
  <DockedComposer {...args}>
    <div className="slds-p-horizontal_medium slds-p-vertical_large slds-scrollable_y">Example body</div>
  </DockedComposer>
);

export const Base = Template.bind({});
