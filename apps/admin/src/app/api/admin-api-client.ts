import { ADMIN_REQUEST_HEADER, AdminApiErrorResponse, AdminApiSuccessResponse } from '@jetstream/admin/types';
import { useCallback, useEffect, useState } from 'react';

export const LOGIN_ROUTE = '/login';

export class AdminApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Only allow same-origin relative paths as a post-login destination so a crafted `returnTo` cannot
 * bounce the admin to another site after sign-in.
 */
export function getSafeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//') || returnTo.startsWith('/\\')) {
    return '/';
  }
  if (returnTo.startsWith(LOGIN_ROUTE)) {
    return '/';
  }
  return returnTo;
}

export function getLoginPath(returnTo: string): string {
  return `${LOGIN_ROUTE}?returnTo=${encodeURIComponent(getSafeReturnTo(returnTo))}`;
}

function redirectToLogin() {
  const { pathname, search } = window.location;
  if (pathname === LOGIN_ROUTE) {
    return;
  }
  window.location.assign(getLoginPath(`${pathname}${search}`));
}

/**
 * Called when the API reports there is no admin session. Swappable so tests can observe it without
 * triggering a jsdom navigation.
 */
export const unauthorizedHandler = { current: redirectToLogin };

function isErrorResponse(payload: unknown): payload is AdminApiErrorResponse {
  return !!payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string';
}

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(method: 'GET' | 'POST' | 'DELETE', path: string, { body, signal }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    [ADMIN_REQUEST_HEADER]: '1',
  };
  const requestInit: RequestInit = { method, credentials: 'same-origin', headers, signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestInit.body = JSON.stringify(body);
  }

  const response = await fetch(path, requestInit);

  if (response.status === 401) {
    unauthorizedHandler.current();
    throw new AdminApiError('Your session has expired. Sign in again to continue.', 401);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = isErrorResponse(payload) ? payload.message : `Request failed with status ${response.status}`;
    throw new AdminApiError(message, response.status, isErrorResponse(payload) ? payload.details : undefined);
  }

  return (payload as AdminApiSuccessResponse<T>).data;
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>('GET', path, { signal });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, { body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong';
}

export interface ApiQueryResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

export interface ApiQueryOptions {
  /**
   * Keep showing the previous path's data while a different path loads or after it fails, so search
   * results don't flash empty between keystrokes. Off by default: a detail page must never render, or
   * act on, another record's data under the current record's URL.
   */
  keepPreviousData?: boolean;
}

/**
 * Fetches `path` whenever it changes (pass null to skip). A reload of the same path keeps its data
 * visible while in flight and after a failure; see `keepPreviousData` for a change of path.
 */
export function useApiQuery<T>(path: string | null, { keepPreviousData = false }: ApiQueryOptions = {}): ApiQueryResult<T> {
  const [reloadCount, setReloadCount] = useState(0);
  // Each fetch is identified by path + reload count; loading and error are derived by comparing the
  // settled request against the current one, so the effect never has to set state synchronously
  const requestKey = path ? `${path}#${reloadCount}` : null;
  const [settled, setSettled] = useState<{ requestKey: string | null; dataPath: string | null; data: T | null; error: Error | null }>({
    requestKey: null,
    dataPath: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!path || !requestKey) {
      return;
    }
    const abortController = new AbortController();
    apiGet<T>(path, abortController.signal)
      .then((result) => {
        if (!abortController.signal.aborted) {
          setSettled({ requestKey, dataPath: path, data: result, error: null });
        }
      })
      .catch((ex: unknown) => {
        if (!abortController.signal.aborted) {
          const error = ex instanceof Error ? ex : new Error(getErrorMessage(ex));
          setSettled((previous) => ({ ...previous, requestKey, error }));
        }
      });
    return () => abortController.abort();
  }, [path, requestKey]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const isCurrentRequestSettled = settled.requestKey === requestKey;
  const data = keepPreviousData || settled.dataPath === path ? settled.data : null;
  const error = isCurrentRequestSettled ? settled.error : null;
  const loading = !!requestKey && !isCurrentRequestSettled;

  return { data, error, loading, reload };
}
