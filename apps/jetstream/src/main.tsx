import React from 'react';
import ReactDOM from 'react-dom';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import App from './app/app';
import './main.scss';

ReactDOM.render(
  <div className="app">
    <App />
  </div>,
  document.getElementById('root')
);
