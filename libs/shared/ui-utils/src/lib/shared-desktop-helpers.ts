export const isDesktop = () => {
  try {
    return !!globalThis.__IS_DESKTOP__;
  } catch (ex) {
    return false;
  }
};
