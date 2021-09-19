/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable no-script-url */

import { array, boolean, text } from '@storybook/addon-knobs';
import PopoverErrorButton from './PopoverErrorButton';

export default {
  title: 'PopoverErrorButton',
  component: PopoverErrorButton,
};

export const base = () => (
  <PopoverErrorButton
    initOpenState={boolean('initOpenState', false)}
    header={text('header', 'Uh Oh! We hit a snag!')}
    listHeader={text('listHeader', 'These are the errors')}
    errors={array('errors', ['Error 1', 'Error 2', 'Error 3'])}
  />
);

export const initiallyOpen = () => (
  <PopoverErrorButton
    initOpenState={boolean('initOpenState', true)}
    header={text('header', 'Uh Oh! We hit a snag!')}
    listHeader={text('listHeader', null)}
    errors={array('errors', ['Error 1'])}
  />
);

export const onlyOneError = () => (
  <PopoverErrorButton
    initOpenState={boolean('initOpenState', true)}
    header={text('header', 'Uh Oh! We hit a snag!')}
    listHeader={text('listHeader', null)}
    errors={text('errors', 'This is my one and only error')}
  />
);
