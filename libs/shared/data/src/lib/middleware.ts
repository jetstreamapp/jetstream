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
