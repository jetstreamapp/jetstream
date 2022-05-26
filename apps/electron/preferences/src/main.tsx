import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import './styles.scss';
import PreferencesApp from './app/PreferencesApp';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <PreferencesApp />
  </StrictMode>
);
