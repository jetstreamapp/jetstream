/* eslint-disable no-restricted-globals */
/// <reference types="chrome"/>

// TODO: do we need a popover ui of any kind?

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.options?.newValue) {
    //
  }
});
