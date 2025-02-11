export const isBrowserExtension = () => {
  try {
    return !!window?.__IS_BROWSER_EXTENSION__ || !!(globalThis?.browser || globalThis?.chrome)?.runtime?.id;
  } catch (ex) {
    return false;
  }
};

export const getBrowserExtensionVersion = () => {
  try {
    return (globalThis?.browser || globalThis?.chrome)?.runtime?.getManifest()?.version || 'UNKNOWN';
  } catch (ex) {
    return 'UNKNOWN';
  }
};
