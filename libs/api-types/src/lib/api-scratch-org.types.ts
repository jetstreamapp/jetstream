import { z } from 'zod';

export const SCRATCH_ORG_EDITIONS = [
  'Developer',
  'Enterprise',
  'Group',
  'Professional',
  'Partner Developer',
  'Partner Enterprise',
  'Partner Group',
  'Partner Professional',
] as const;

export const SCRATCH_ORG_RELEASES = ['Current', 'Preview', 'Previous'] as const;

export const SCRATCH_ORG_MIN_DURATION_DAYS = 1;
export const SCRATCH_ORG_MAX_DURATION_DAYS = 30;
export const SCRATCH_ORG_DEFAULT_DURATION_DAYS = 7;

/**
 * Sent when a scratch org could not be connected because it cannot be reached yet (a new My Domain takes a few minutes
 * to resolve). Nothing was consumed, so the client keeps trying while a message starts with this.
 */
export const SCRATCH_ORG_NOT_REACHABLE_MESSAGE = 'The scratch org is not reachable yet';

/**
 * Starts every message for a scratch org that Salesforce will never let this app connect without a password: it was
 * requested by another app, or its single-use authorization code is gone or was refused. The client then offers the
 * password login instead. Any other failure (network, server, session) leaves the passwordless connection on offer.
 */
export const SCRATCH_ORG_PASSWORDLESS_REFUSED_MESSAGE = 'This scratch org cannot be connected without a password';

const SalesforceIdSchema = z.string().regex(/^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/, 'Must be a 15 or 18 character Salesforce id');

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => value || undefined);

/** Blank is the same as not provided, like the other optional text fields */
const optionalEmail = (maxLength: number) =>
  z
    .preprocess((value) => (typeof value === 'string' ? value.trim() || undefined : value), z.email().max(maxLength).nullish())
    .transform((value) => value || undefined);

/**
 * The options of a scratch org definition file that are stored on the ScratchOrgInfo record. `settings` and
 * `objectSettings` are not part of the request, they are deployed to the scratch org after it is created.
 */
export const ScratchOrgCreateRequestSchema = z
  .object({
    orgName: optionalTrimmedString(80),
    // Not limited to SCRATCH_ORG_EDITIONS, Salesforce adds editions and the Dev Hub validates the value
    edition: optionalTrimmedString(80),
    durationDays: z
      .number()
      .int()
      .min(SCRATCH_ORG_MIN_DURATION_DAYS)
      .max(SCRATCH_ORG_MAX_DURATION_DAYS)
      .nullish()
      .transform((value) => value ?? SCRATCH_ORG_DEFAULT_DURATION_DAYS),
    adminEmail: optionalEmail(255),
    description: optionalTrimmedString(2000),
    features: z
      .array(z.string().trim().min(1).max(255))
      .max(200)
      .nullish()
      .transform((value) => value || []),
    hasSampleData: z.boolean().nullish(),
    release: z.enum(SCRATCH_ORG_RELEASES).nullish(),
    country: optionalTrimmedString(2),
    language: optionalTrimmedString(10),
    username: optionalEmail(80).transform((value) => value?.toLowerCase()),
    namespace: optionalTrimmedString(15),
    /** Create from an org shape, this is the id of the org the shape was captured from */
    sourceOrg: SalesforceIdSchema.nullish(),
    snapshot: optionalTrimmedString(255),
  })
  .refine(({ edition, sourceOrg, snapshot }) => !!edition || !!sourceOrg || !!snapshot, {
    message: 'An edition is required unless the scratch org is created from an org shape or a snapshot',
    path: ['edition'],
  })
  .refine(({ sourceOrg, snapshot }) => !(sourceOrg && snapshot), {
    message: 'A scratch org cannot be created from both an org shape and a snapshot',
    path: ['snapshot'],
  });

export type ScratchOrgCreateRequest = z.infer<typeof ScratchOrgCreateRequestSchema>;
export type ScratchOrgCreateRequestInput = z.input<typeof ScratchOrgCreateRequestSchema>;

export const ScratchOrgInfoIdParamsSchema = z.object({
  // 2SR is the key prefix of ScratchOrgInfo
  scratchOrgInfoId: z.string().regex(/^2SR[a-zA-Z0-9]{12}(?:[a-zA-Z0-9]{3})?$/, 'Invalid scratch org info id'),
});
