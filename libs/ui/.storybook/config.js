import { configure, addDecorator } from '@storybook/react';
import { withKnobs } from '@storybook/addon-knobs';
import { withActions } from '@storybook/addon-actions';
import StoryRouter from 'storybook-react-router';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import '../../../apps/jetstream/src/main.scss';

addDecorator(withKnobs);
addDecorator(withActions());
addDecorator(StoryRouter());
configure(require.context('../..', true, /\.stories\.(j|t)sx?$/), module);

let modalRoot = document.createElement('div');
modalRoot.setAttribute('id', 'modal-root');
document.querySelector('body').appendChild(modalRoot);
