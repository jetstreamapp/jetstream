// This file must be manually updated here on occasion
// this is to avoid circular dependency
import './main.scss';

const modalRoot = document.createElement('div');
modalRoot.setAttribute('id', 'modal-root');
document.querySelector('body')?.appendChild(modalRoot);
