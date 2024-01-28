/* eslint-disable no-restricted-globals */
/// <reference types="chrome"/>
import * as ReactDOM from 'react-dom/client';
import Button from './components/Button';

/**
 * This will change `publicPath` to `chrome-extension://<extension_id>/`.
 * It for runtime to get script chunks from the output folder
 * and for asset modules like file-loader to work.
 */
// @ts-expect-error - see above comment
__webpack_public_path__ = chrome.runtime.getURL('');

console.log('Content script loaded.');

const app = document.createElement('div');
app.id = 'jetstream-root';
document.body.appendChild(app);

const root = ReactDOM.createRoot(document.getElementById('jetstream-root') as HTMLElement);
root.render(<Button />);
