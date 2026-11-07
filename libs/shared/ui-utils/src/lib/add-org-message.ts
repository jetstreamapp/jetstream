import { ensureBoolean } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import isString from 'lodash/isString';

/** Fields the server always includes in the org it posts back from the OAuth popup */
const REQUIRED_ORG_STRING_FIELDS: (keyof SalesforceOrgUi)[] = [
  'uniqueId',
  'label',
  'instanceUrl',
  'loginUrl',
  'username',
  'organizationId',
];

function isSalesforceOrgPayload(value: unknown): value is SalesforceOrgUi {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return REQUIRED_ORG_STRING_FIELDS.every((field) => isString(record[field]) && record[field] !== '');
}

/**
 * Validate a `message` event received while the "add org" popup is open and return the org it carries.
 *
 * The popup finishes on `${serverUrl}/oauth-link/`, which posts the org back to `window.opener` as a JSON string,
 * so a message only counts when it comes from that origin, from the popup window itself, and parses to an org.
 * Everything else yields `null` and must be ignored.
 */
export function getOrgFromAddOrgMessage(
  event: Pick<MessageEvent, 'data' | 'origin' | 'source'>,
  expectedOrigin: string,
  popupWindow: Window | null | undefined,
): SalesforceOrgUi | null {
  if (event.origin !== expectedOrigin) {
    return null;
  }
  if (!popupWindow || event.source !== popupWindow) {
    return null;
  }
  if (!isString(event.data)) {
    return null;
  }
  try {
    const org: unknown = JSON.parse(event.data);
    if (!isSalesforceOrgPayload(org)) {
      return null;
    }
    org.orgIsSandbox = ensureBoolean(org.orgIsSandbox);
    return org;
  } catch {
    return null;
  }
}
