import { z } from 'zod';

/**
 * Default number of Salesforce orgs an entitled user/team may authorize for the Canvas app.
 * A single production org already covers all of its sandboxes (matched by My Domain base), so the
 * cap is generous headroom for genuine multi-org cases (consultants, M&A) rather than a per-sandbox
 * limit. Shared between the create endpoint (enforcement) and the UI (disable "Authorize Org" at the cap).
 */
export const SALESFORCE_CANVAS_ORG_LIMIT = 10;

/** A Salesforce org id: 15- or 18-character, always beginning with the `00D` key prefix. */
export const SALESFORCE_ORG_ID_REGEX = /^00D[A-Za-z0-9]{12}([A-Za-z0-9]{3})?$/;

/**
 * The "My Domain" base fragment (e.g. `acme` from `acme.my.salesforce.com`) — lowercase letters,
 * digits, and internal hyphens. Authorizing this extends Canvas access to the org's sandboxes, which
 * share the same base but get a brand-new org id.
 */
export const SALESFORCE_MY_DOMAIN_BASE_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export const SalesforceCanvasOrgStatusSchema = z.enum(['ACTIVE', 'REVOKED']);
export type SalesforceCanvasOrgStatus = z.infer<typeof SalesforceCanvasOrgStatusSchema>;

/** User-facing representation of an authorized Canvas org (owner ids intentionally omitted). */
export const SalesforceCanvasOrgSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  instanceUrl: z.string(),
  myDomainBase: z.string().nullish(),
  orgName: z.string().nullish(),
  isSandbox: z.boolean().nullish(),
  status: SalesforceCanvasOrgStatusSchema,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type SalesforceCanvasOrg = z.infer<typeof SalesforceCanvasOrgSchema>;

export const CreateSalesforceCanvasOrgRequestSchema = z.object({
  organizationId: z
    .string()
    .trim()
    .regex(SALESFORCE_ORG_ID_REGEX, { error: 'Enter a valid 15 or 18 character Salesforce organization id (starts with 00D)' }),
  myDomainBase: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(255)
    .regex(SALESFORCE_MY_DOMAIN_BASE_REGEX, { error: 'Enter just the My Domain name, for example "acme"' }),
  orgName: z.string().trim().max(255).optional(),
});
export type CreateSalesforceCanvasOrgRequest = z.infer<typeof CreateSalesforceCanvasOrgRequestSchema>;

export const UpdateSalesforceCanvasOrgRequestSchema = z.object({
  orgName: z.string().trim().max(255).nullish(),
  status: SalesforceCanvasOrgStatusSchema.optional(),
});
export type UpdateSalesforceCanvasOrgRequest = z.infer<typeof UpdateSalesforceCanvasOrgRequestSchema>;
