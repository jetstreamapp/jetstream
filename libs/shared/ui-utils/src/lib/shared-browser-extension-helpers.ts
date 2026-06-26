export const isBrowserExtension = () => {
  try {
    return !!globalThis.__IS_BROWSER_EXTENSION__;
  } catch {
    return false;
  }
};

export const getBrowserExtensionVersion = () => {
  try {
    return ((globalThis as any)?.browser || (globalThis as any)?.chrome)?.runtime?.getManifest()?.version || 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
};
