import { boolean } from '@storybook/addon-knobs';
import Accordion, { AccordionProps } from './Accordion';
import { Story, Meta } from '@storybook/react';

export default {
  title: 'Accordion',
  component: Accordion,
  argTypes: {
    sections: {
      control: false,
    },
  },
  args: {
    initOpenIds: [],
    showExpandCollapseAll: false,
    allowMultiple: false,
  },
} as Meta;

const Template: Story<AccordionProps> = (args) => (
  <Accordion
    sections={[
      { id: '1', title: 'Section 1', content: <span>Accordion content 1</span> },
      { id: '2', title: 'Section 2', content: <span>Accordion content 2</span> },
      { id: '3', title: 'Section 3', content: <span>Accordion content 3</span> },
      { id: '4', title: 'Section 4', content: <span>Accordion content 4</span> },
    ]}
    {...args}
  ></Accordion>
);

export const Base = Template.bind({});

export const EverythingOn = Template.bind({});
EverythingOn.args = {
  initOpenIds: ['1', '3', '4'],
  showExpandCollapseAll: true,
  allowMultiple: true,
};
