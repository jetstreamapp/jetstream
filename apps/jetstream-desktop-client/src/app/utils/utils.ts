import { SETTINGS_WINDOW_PARAM } from '@jetstream/desktop/types';
import { AddOrgHandlerFn, SalesforceOrgUi } from '@jetstream/types';

export const addDesktopOrg: AddOrgHandlerFn = async (
  { loginUrl, addLoginTrue, orgGroupId, loginHint },
  callback: (org: SalesforceOrgUi) => void,
) => {
  if (!window.electronAPI) {
    return;
  }

  await window.electronAPI.addOrg({ loginUrl, addLoginTrue, orgGroupId, loginHint });

  const handlerFn = (org: SalesforceOrgUi) => {
    callback(org);
  };

  // TODO: how do we unsubscribe from this event?
  // TODO: we should probably just have this add the org to the store in every case - but there is a memory leak here
  window.electronAPI.onOrgAdded(handlerFn);
};

/** True in the standalone Settings window, which shows only the Settings page */
export function isSettingsWindow() {
  return new URLSearchParams(window.location.search).get(SETTINGS_WINDOW_PARAM.name) === SETTINGS_WINDOW_PARAM.value;
}
