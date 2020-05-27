import { boolean } from '@storybook/addon-knobs';
import React from 'react';
import Accordion from './Accordion';

export default {
  component: Accordion,
  title: 'Accordion',
};

export const base = () => (
  <Accordion
    initOpenIds={[]}
    sections={[
      { id: '1', title: 'Section 1', content: <span>Accordion content 1</span> },
      { id: '2', title: 'Section 2', content: <span>Accordion content 2</span> },
      { id: '3', title: 'Section 3', content: <span>Accordion content 3</span> },
      { id: '4', title: 'Section 4', content: <span>Accordion content 4</span> },
    ]}
    allowMultiple={boolean('allowMultiple', false)}
  ></Accordion>
);
