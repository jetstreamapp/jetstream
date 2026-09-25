import isEqual from 'lodash/isEqual';

/**
 * The values to put back after a failed save: the last successfully saved value of each setting the save tried
 * to change, but only for settings that still hold the value it tried to write - a setting changed again since
 * then keeps its newer value. Restoring the last saved value (rather than whatever was showing when the save was
 * queued) matters when saves queue up, because that earlier value may itself have been a change that failed.
 */
export function getPreferencesToRestore<T extends object>(current: T, attempted: Partial<T>, saved: Partial<T>): Partial<T> {
  const keysToRestore = (Object.keys(attempted) as (keyof T)[]).filter((key) => isEqual(current[key], attempted[key]));
  return Object.fromEntries(keysToRestore.map((key) => [key, saved[key]])) as Partial<T>;
}
