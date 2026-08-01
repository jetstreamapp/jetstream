/**
 * Objects that accept an `ObjectPermissions` record but do not support View All Records / Modify All
 * Records. Salesforce does not reject these - it accepts the DML, reports success, and silently drops
 * the value, so the checkbox appears to save and then reverts on the next load. There is no describe
 * flag exposing this, so the list is maintained by hand.
 *
 * Salesforce documents ideas, price books, article types and products as unsupported; `PushTopic` and
 * `PendingOrdSumProcEvent` were confirmed against a live org.
 *
 * @see https://help.salesforce.com/s/articleView?id=platform.users_profiles_view_all_mod_all.htm&type=5
 */
export const OBJECTS_WITHOUT_VIEW_ALL_MODIFY_ALL = new Set(['Idea', 'PendingOrdSumProcEvent', 'Pricebook2', 'Product2', 'PushTopic']);

export const VIEW_ALL_MODIFY_ALL_UNSUPPORTED_MESSAGE =
  'Salesforce does not support View All or Modify All for this object. Access is controlled through sharing settings instead.';

export function supportsViewAllModifyAll(sobject: string): boolean {
  return !OBJECTS_WITHOUT_VIEW_ALL_MODIFY_ALL.has(sobject);
}
