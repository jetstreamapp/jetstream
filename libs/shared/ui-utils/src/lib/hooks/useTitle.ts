import { isDesktop } from '../shared-desktop-helpers';

const TITLE_SUFFIX = ' | Jetstream';

/**
 * An installed PWA window already shows the app name in its title bar - Chrome renders
 * "Jetstream - {document.title}" - so the usual suffix reads as "Jetstream - Query | Jetstream".
 * Drop it there only; browser tabs and bookmarks still need it to say what app they belong to.
 * Desktop is excluded because its window chrome is Electron's, not Chrome's app-window UI.
 */
function formatTitle(title: string): string {
  if (isDesktop() || !title.endsWith(TITLE_SUFFIX) || !window.matchMedia?.('(display-mode: standalone)').matches) {
    return title;
  }
  return title.slice(0, -TITLE_SUFFIX.length);
}

export function useTitle(title: string) {
  const documentTitle = formatTitle(title);
  if (document.title !== documentTitle) {
    document.title = documentTitle;
  }
}
