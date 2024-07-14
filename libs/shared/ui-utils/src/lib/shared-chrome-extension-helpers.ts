/// <reference types="chrome" />

export const isChromeExtension = () => {
  try {
    return !!window?.chrome?.runtime?.id;
  } catch (ex) {
    return false;
  }
};

export const getChromeExtensionVersion = () => {
  try {
    return window?.chrome?.runtime?.getManifest()?.version || 'UNKNOWN';
  } catch (ex) {
    return 'UNKNOWN';
  }
};
