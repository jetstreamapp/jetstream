// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './_config';
// DO NOT CHANGE ORDER OF IMPORTS

import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import React from 'react';
import { render } from 'react-dom';
// import { createRoot } from 'react-dom/client';
import App from './app/app';
import './main.scss';

const container = document.getElementById('root');

// REACT 18 MODE
// createRoot(container).render(
//   <div className="app">
//     <BrowserRouter basename="/app">
//       <App />
//     </BrowserRouter>
//   </div>
// );

// REACT 17 MODE
render(
  <div className="app">
    <CONFIG.Router basename="/app">
      <App />
    </CONFIG.Router>
  </div>,
  container
);
