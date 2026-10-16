import { z } from 'zod';

/**
 * Every state-changing request from the admin SPA must carry this header. A cross-site form or
 * image tag cannot set a custom header, and a cross-origin fetch that sets one needs a CORS
 * preflight the admin API never approves, so its presence proves the request came from our origin.
 */
export const ADMIN_REQUEST_HEADER = 'X-Admin-Request';

/** Path the SPA sends the browser to when there is no admin session */
export const ADMIN_LOGIN_PATH = '/auth/login';

export const ADMIN_LOGOUT_PATH = '/auth/logout';

/** Query parameter the API appends to the SPA login route when Google sign-in is rejected */
export const ADMIN_LOGIN_ERROR_PARAM = 'error';

export const AdminLoginErrorCodeSchema = z.enum(['NOT_ALLOWED', 'INVALID_STATE', 'SIGN_IN_FAILED', 'ACCESS_IDENTITY_MISMATCH']);
export type AdminLoginErrorCode = z.infer<typeof AdminLoginErrorCodeSchema>;

export interface AdminApiSuccessResponse<T> {
  data: T;
}

export interface AdminApiErrorResponse {
  error: true;
  message: string;
  details?: unknown;
}

export interface AdminSessionUser {
  email: string;
  name: string | null;
  picture: string | null;
}

export const DEFAULT_PAGE_SIZE = 50;

/** Search text plus 1-based page number shared by the paginated list endpoints */
export const PaginatedSearchQuerySchema = z.object({
  query: z.string().trim().max(255).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(DEFAULT_PAGE_SIZE),
});
export type PaginatedSearchQuery = z.infer<typeof PaginatedSearchQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  /** Rows matching the filters across every page */
  total: number;
  page: number;
  pageSize: number;
}

export const SortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const IdParamsSchema = z.object({
  id: z.guid(),
});

export interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string | null;
  teamId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface EntitlementFlags {
  chromeExtension: boolean;
  googleDrive: boolean;
  recordSync: boolean;
  desktop: boolean;
  analysisTools: boolean;
  salesforceCanvas: boolean;
}

export const EntitlementFlagsSchema = z.object({
  chromeExtension: z.boolean(),
  googleDrive: z.boolean(),
  recordSync: z.boolean(),
  desktop: z.boolean(),
  analysisTools: z.boolean(),
  salesforceCanvas: z.boolean(),
});

export interface SubscriptionItem {
  subscriptionId: string;
  priceId: string;
  status: string;
  createdAt: string;
}
