import React from 'react';
import ReactDOM from 'react-dom';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import App from './app/app';
import './main.scss';
import { BrowserRouter as Router } from 'react-router-dom';

ReactDOM.render(
  <div className="app">
    <Router basename="/app">
      <App />
    </Router>
  </div>,
  document.getElementById('root')
);
