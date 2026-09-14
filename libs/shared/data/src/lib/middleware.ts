import { SalesforceOrgUi } from '@jetstream/types';
import { AxiosResponse } from 'axios';

// Network failures, timeouts, and other errors that produce no response will not call these functions
export type HttpErrorMiddlewareFn = (response: AxiosResponse, org?: SalesforceOrgUi) => void;

// Could add these in future
// const requestMiddleware = [];
// const responseMiddleware = [];
export const errorMiddleware: HttpErrorMiddlewareFn[] = [];

/**
 * TODO:
 * As other use-cases come up, this can be built out more
 * @param type String 'Error'
 * @param fn HttpErrorMiddlewareFn
 */
export function registerMiddleware(_ = 'Error', fn: HttpErrorMiddlewareFn) {
  errorMiddleware.push(fn);
}

export type OrgActivityListenerFn = (org: SalesforceOrgUi) => void;

const orgActivityListeners = new Set<OrgActivityListenerFn>();

/**
 * Subscribe to orgs the server has just confirmed activity on. Returns an unsubscribe function.
 *
 * Every request made on behalf of an org resolves that org server-side, which resets its inactivity
 * clock and clears any scheduled expiration. Nothing in the response says so, so without this the
 * client keeps showing an expiration warning for an org it just successfully used until the org list
 * is re-fetched.
 */
export function onOrgActivity(listener: OrgActivityListenerFn): () => void {
  orgActivityListeners.add(listener);
  return () => {
    orgActivityListeners.delete(listener);
  };
}

/** Called for every successful response the server actually produced on behalf of an org */
export function notifyOrgActivity(org: SalesforceOrgUi) {
  orgActivityListeners.forEach((listener) => listener(org));
}
