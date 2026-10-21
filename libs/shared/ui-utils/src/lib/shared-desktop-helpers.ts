export const isDesktop = () => {
  try {
    return !!globalThis.__IS_DESKTOP__;
  } catch {
    return false;
  }
};

/**
 * The folder the desktop app saves downloads to without prompting (Settings → Downloads),
 * or null when the user is asked where to save each download or when not running on desktop.
 */
export async function getDesktopAutoSaveDownloadFolder(): Promise<string | null> {
  if (!isDesktop() || !window.electronAPI) {
    return null;
  }
  const { fileDownload } = await window.electronAPI.getPreferences();
  return fileDownload?.omitPrompt && fileDownload.downloadPath ? fileDownload.downloadPath : null;
}
