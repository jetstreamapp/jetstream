/* eslint-disable no-restricted-globals */
/// <reference types="chrome"/>
import * as ReactDOM from 'react-dom/client';
import Button from './components/Button';

console.log('Content script loaded.');

const app = document.createElement('div');
app.id = 'jetstream-root';
document.body.appendChild(app);

const root = ReactDOM.createRoot(document.getElementById('jetstream-root') as HTMLElement);
root.render(<Button />);
