export const isCanvasApp = () => {
  try {
    return !!globalThis.__IS_CANVAS_APP__;
  } catch {
    return false;
  }
};
