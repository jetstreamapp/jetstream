import { z } from 'zod';

/**
 * Jetstream access profiles control which tools and operations a team member sees in Jetstream.
 *
 * Tools and operations are UI guards: a member with a modified client or a hand-built API call can bypass
 * them, so they must never be described as a security boundary. Surfaces are the exception, the server
 * refuses desktop and browser extension sign in for a member whose profile excludes that surface, and refuses
 * to connect a web session to Salesforce when the profile excludes the web application.
 *
 * A member without a profile has full access, which is computed from this catalog at runtime so new
 * capabilities reach them automatically. Custom profiles are allow-lists, so a capability added in a later
 * release stays off for them until an admin turns it on.
 */

export const ACCESS_PROFILE_POLICY_VERSION = 1;

export const ACCESS_PROFILE_TOOL_KEYS = [
  'query',
  'load',
  'update-records',
  'create-record',
  'data-history',
  'automation-control',
  'manage-permissions',
  'permission-analysis',
  'data-analysis',
  'deploy-metadata',
  'create-fields',
  'formula-evaluator',
  'record-type-manager',
  'anonymous-apex',
  'apex-tests',
  'debug-logs',
  'object-export',
  'salesforce-api',
  'platform-events',
] as const;

export const ACCESS_PROFILE_OPERATION_KEYS = ['records.write', 'records.delete', 'metadata.deploy', 'orgs.connect'] as const;

/**
 * Without `web` a member can still sign in to the web application, because their profile, settings and the team
 * dashboard live there, but every tool and Salesforce connection is unavailable to them.
 */
export const ACCESS_PROFILE_SURFACE_KEYS = ['web', 'desktop', 'browser-extension'] as const;

export const AccessProfileToolKeySchema = z.enum(ACCESS_PROFILE_TOOL_KEYS);
export const AccessProfileOperationKeySchema = z.enum(ACCESS_PROFILE_OPERATION_KEYS);
export const AccessProfileSurfaceKeySchema = z.enum(ACCESS_PROFILE_SURFACE_KEYS);

export type AccessProfileToolKey = z.infer<typeof AccessProfileToolKeySchema>;
export type AccessProfileOperationKey = z.infer<typeof AccessProfileOperationKeySchema>;
export type AccessProfileSurfaceKey = z.infer<typeof AccessProfileSurfaceKeySchema>;

export type AccessProfileToolGroup = 'data' | 'admin' | 'metadata' | 'developer';

export interface AccessProfileToolDefinition {
  key: AccessProfileToolKey;
  label: string;
  description: string;
  group: AccessProfileToolGroup;
  /** Operations the tool's primary actions need; without them the tool opens with those actions hidden */
  requiredOperations: AccessProfileOperationKey[];
  /** Can perform arbitrary reads and writes, so hiding an operation's buttons does not stop it */
  isEscapeHatch?: boolean;
}

export interface AccessProfileOperationDefinition {
  key: AccessProfileOperationKey;
  label: string;
  description: string;
}

export interface AccessProfileSurfaceDefinition {
  key: AccessProfileSurfaceKey;
  label: string;
  description: string;
}

export const ACCESS_PROFILE_TOOL_GROUPS: { key: AccessProfileToolGroup; label: string }[] = [
  { key: 'data', label: 'Data' },
  { key: 'admin', label: 'Administration' },
  { key: 'metadata', label: 'Metadata' },
  { key: 'developer', label: 'Developer' },
];

export const ACCESS_PROFILE_TOOLS: AccessProfileToolDefinition[] = [
  {
    key: 'query',
    label: 'Query Records',
    description: 'Query builder, results, Quick Query and the global record search',
    group: 'data',
    requiredOperations: [],
  },
  {
    key: 'load',
    label: 'Load Records',
    description: 'Insert, update, upsert or delete records from a file, for one or multiple objects',
    group: 'data',
    requiredOperations: ['records.write'],
  },
  {
    key: 'update-records',
    label: 'Update Records Without a File',
    description: 'Bulk update a field across records',
    group: 'data',
    requiredOperations: ['records.write'],
  },
  {
    key: 'create-record',
    label: 'Create New Record',
    description: 'Create a single record',
    group: 'data',
    requiredOperations: ['records.write'],
  },
  {
    key: 'data-history',
    label: 'Data History',
    description: 'Prior data load files and results',
    group: 'data',
    requiredOperations: [],
  },
  {
    key: 'platform-events',
    label: 'Platform Events',
    description: 'Subscribe to and publish platform events',
    group: 'data',
    requiredOperations: [],
  },
  {
    key: 'automation-control',
    label: 'Automation Control',
    description: 'View and toggle flows, triggers, validation rules and workflow rules',
    group: 'admin',
    requiredOperations: ['metadata.deploy'],
  },
  {
    key: 'manage-permissions',
    label: 'Manage Permissions',
    description: 'View and change object, field and tab permissions',
    group: 'admin',
    requiredOperations: ['metadata.deploy'],
  },
  {
    key: 'permission-analysis',
    label: 'Permission Analysis',
    description: 'Audit profiles and permission sets',
    group: 'admin',
    requiredOperations: [],
  },
  {
    key: 'data-analysis',
    label: 'Data Analysis',
    description: 'Field usage and data quality analysis',
    group: 'admin',
    requiredOperations: [],
  },
  {
    key: 'deploy-metadata',
    label: 'Deploy and Compare Metadata',
    description: 'View, compare, download and deploy metadata',
    group: 'metadata',
    requiredOperations: [],
  },
  {
    key: 'create-fields',
    label: 'Create Object and Fields',
    description: 'Create custom objects and fields',
    group: 'metadata',
    requiredOperations: ['metadata.deploy'],
  },
  {
    key: 'record-type-manager',
    label: 'Record Type Picklist Manager',
    description: 'View and update record type picklist values',
    group: 'metadata',
    requiredOperations: ['metadata.deploy'],
  },
  {
    key: 'formula-evaluator',
    label: 'Formula Evaluator',
    description: 'Test formulas against records',
    group: 'metadata',
    requiredOperations: [],
  },
  {
    key: 'object-export',
    label: 'Export Object Metadata',
    description: 'Export object and field metadata to a file',
    group: 'metadata',
    requiredOperations: [],
  },
  {
    key: 'anonymous-apex',
    label: 'Anonymous Apex',
    description: 'Run arbitrary Apex code',
    group: 'developer',
    requiredOperations: [],
    isEscapeHatch: true,
  },
  {
    key: 'apex-tests',
    label: 'Apex Test Runner',
    description: 'Run Apex tests and view coverage',
    group: 'developer',
    requiredOperations: [],
  },
  {
    key: 'debug-logs',
    label: 'Debug Logs',
    description: 'View, and with delete access purge, debug logs',
    group: 'developer',
    requiredOperations: [],
  },
  {
    key: 'salesforce-api',
    label: 'Salesforce API',
    description: 'Send any request to the Salesforce REST API',
    group: 'developer',
    requiredOperations: [],
    isEscapeHatch: true,
  },
];

export const ACCESS_PROFILE_OPERATIONS: AccessProfileOperationDefinition[] = [
  {
    key: 'records.write',
    label: 'Create and update records',
    description:
      'Inline and bulk edits in query results, record edit and clone, insert, update and upsert loads, and publishing platform events',
  },
  {
    key: 'records.delete',
    label: 'Delete records',
    description: 'Delete and undelete from query results, delete loads and purging debug logs',
  },
  {
    key: 'metadata.deploy',
    label: 'Deploy metadata and change configuration',
    description:
      'Deploy or delete metadata, create fields, toggle automation, save permission changes and manage permission set assignments',
  },
  {
    key: 'orgs.connect',
    label: 'Connect Salesforce orgs',
    description: 'Add new Salesforce orgs to Jetstream',
  },
];

/**
 * Explains an action that is disabled because the member's access does not include its operation. Worded without
 * "team" because canvas users get the same messages from Salesforce custom permissions.
 */
export const ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES: Record<AccessProfileOperationKey, string> = {
  'records.write': `Your Jetstream access does not include creating or updating records.`,
  'records.delete': `Your Jetstream access does not include deleting records.`,
  'metadata.deploy': `Your Jetstream access does not include deploying metadata or changing configuration.`,
  'orgs.connect': `Your Jetstream access does not include connecting Salesforce orgs.`,
};

export const ACCESS_PROFILE_SURFACES: AccessProfileSurfaceDefinition[] = [
  {
    key: 'web',
    label: 'Web application',
    description: 'Without it, members can still sign in to manage their profile and settings, but cannot connect orgs or use any tools',
  },
  { key: 'desktop', label: 'Desktop application', description: "Salesforce data stays on the member's computer" },
  { key: 'browser-extension', label: 'Browser extension', description: "Salesforce data stays in the member's browser" },
];

/**
 * Reading is lenient so a policy saved by a newer or older release still parses: unknown keys are dropped,
 * which for an allow-list can only remove access.
 */
function knownKeys<T extends string>(allowed: readonly T[]) {
  const allowedSet = new Set<unknown>(allowed);
  return z
    .array(z.unknown())
    .catch([])
    .transform((values) => Array.from(new Set(values.filter((value): value is T => allowedSet.has(value)))));
}

export const AccessProfilePolicySchema = z
  .object({
    v: z.number().int().catch(ACCESS_PROFILE_POLICY_VERSION),
    tools: knownKeys(ACCESS_PROFILE_TOOL_KEYS),
    operations: knownKeys(ACCESS_PROFILE_OPERATION_KEYS),
    surfaces: knownKeys(ACCESS_PROFILE_SURFACE_KEYS),
  })
  // A policy that is not an object at all grants nothing, rather than failing every profile and team response
  .catch({ v: ACCESS_PROFILE_POLICY_VERSION, tools: [], operations: [], surfaces: [] });
export type AccessProfilePolicy = z.infer<typeof AccessProfilePolicySchema>;

/** Writing is strict so a typo in a request is rejected rather than silently dropped */
export const AccessProfilePolicyRequestSchema = z.object({
  tools: z.array(AccessProfileToolKeySchema).transform((values) => Array.from(new Set(values))),
  operations: z.array(AccessProfileOperationKeySchema).transform((values) => Array.from(new Set(values))),
  surfaces: z.array(AccessProfileSurfaceKeySchema).transform((values) => Array.from(new Set(values))),
});
export type AccessProfilePolicyRequest = z.infer<typeof AccessProfilePolicyRequestSchema>;

export const FULL_ACCESS_POLICY: AccessProfilePolicy = {
  v: ACCESS_PROFILE_POLICY_VERSION,
  tools: [...ACCESS_PROFILE_TOOL_KEYS],
  operations: [...ACCESS_PROFILE_OPERATION_KEYS],
  surfaces: [...ACCESS_PROFILE_SURFACE_KEYS],
};

/**
 * Stands in for "no access profile" wherever a profile id travels as a string: the heartbeat fingerprint and the
 * `reassignTo` of a profile delete. The API itself stores the absence of a profile as null.
 */
export const ACCESS_PROFILE_FULL_ACCESS_ID = 'FULL_ACCESS';

/** The slice of a profile a member's client needs to build its ability */
export const AccessProfileAssignmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.number().int(),
  policy: AccessProfilePolicySchema,
});
export type AccessProfileAssignment = z.infer<typeof AccessProfileAssignmentSchema>;

/**
 * Whether a member may sign in to a surface. A member without a profile has full access. A profile whose stored
 * policy cannot be read denies the surface rather than granting it.
 */
export function isAccessProfileSurfaceAllowed(
  accessProfile: { policy: unknown } | null | undefined,
  surface: AccessProfileSurfaceKey,
): boolean {
  if (!accessProfile) {
    return true;
  }
  return AccessProfilePolicySchema.parse(accessProfile.policy).surfaces.includes(surface);
}

/**
 * Changes whenever a member is moved to another profile or their profile is edited, so a client can compare
 * its copy against the server's without downloading the policy.
 */
export function getAccessProfileFingerprint(accessProfile: Pick<AccessProfileAssignment, 'id' | 'version'> | null | undefined) {
  return accessProfile ? `${accessProfile.id}:${accessProfile.version}` : ACCESS_PROFILE_FULL_ACCESS_ID;
}

const DateStringSchema = z.union([z.string(), z.date()]).transform((value) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
});

export const TeamAccessProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  policy: AccessProfilePolicySchema,
  isDefault: z.boolean(),
  version: z.number().int(),
  memberCount: z.number().int().min(0),
  invitationCount: z.number().int().min(0),
  createdAt: DateStringSchema,
  updatedAt: DateStringSchema,
});
export type TeamAccessProfile = z.infer<typeof TeamAccessProfileSchema>;

export const ACCESS_PROFILE_NAME_MAX_LENGTH = 100;
export const ACCESS_PROFILE_DESCRIPTION_MAX_LENGTH = 500;

export const TeamAccessProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(ACCESS_PROFILE_NAME_MAX_LENGTH),
  description: z
    .string()
    .trim()
    .max(ACCESS_PROFILE_DESCRIPTION_MAX_LENGTH)
    .nullish()
    .transform((value) => value || null),
  isDefault: z.boolean().optional().default(false),
  policy: AccessProfilePolicyRequestSchema,
});
export type TeamAccessProfileRequest = z.infer<typeof TeamAccessProfileRequestSchema>;

export interface AccessProfilePolicyWarning {
  type: 'MISSING_REQUIRED_OPERATION' | 'ESCAPE_HATCH' | 'NO_SURFACES';
  message: string;
}

const OPERATIONS_BYPASSED_BY_ESCAPE_HATCHES: AccessProfileOperationKey[] = ['records.write', 'records.delete', 'metadata.deploy'];

/**
 * Explains combinations that do not do what an admin probably expects, so the profile editor can flag them
 */
export function getAccessProfilePolicyWarnings(
  policy: Pick<AccessProfilePolicy, 'tools' | 'operations' | 'surfaces'>,
): AccessProfilePolicyWarning[] {
  const tools = new Set(policy.tools);
  const operations = new Set(policy.operations);
  const operationLabels = new Map(ACCESS_PROFILE_OPERATIONS.map(({ key, label }) => [key, label]));
  const warnings: AccessProfilePolicyWarning[] = [];

  ACCESS_PROFILE_TOOLS.filter(({ key }) => tools.has(key)).forEach(({ label, requiredOperations }) => {
    const missingOperations = requiredOperations.filter((operation) => !operations.has(operation));
    if (missingOperations.length) {
      warnings.push({
        type: 'MISSING_REQUIRED_OPERATION',
        message: `${label} is enabled, but "${missingOperations.map((operation) => operationLabels.get(operation)).join('", "')}" is not. The tool opens with those actions hidden.`,
      });
    }
  });

  const enabledEscapeHatches = ACCESS_PROFILE_TOOLS.filter(({ key, isEscapeHatch }) => isEscapeHatch && tools.has(key));
  const hiddenOperations = OPERATIONS_BYPASSED_BY_ESCAPE_HATCHES.filter((operation) => !operations.has(operation));
  if (enabledEscapeHatches.length && hiddenOperations.length) {
    warnings.push({
      type: 'ESCAPE_HATCH',
      message: `${enabledEscapeHatches.map(({ label }) => label).join(' and ')} can still ${hiddenOperations
        .map((operation) => operationLabels.get(operation)?.toLowerCase())
        .join(', ')} even though those actions are hidden elsewhere. Turn the tool off if that matters.`,
    });
  }

  if (policy.surfaces.length === 0) {
    warnings.push({
      type: 'NO_SURFACES',
      message: 'No application is enabled, so members with this profile can sign in to manage their profile but cannot use any tools.',
    });
  }

  return warnings;
}

/** Number of enabled items out of the total, used for compact summaries */
export function getAccessProfilePolicySummary(policy: Pick<AccessProfilePolicy, 'tools' | 'operations' | 'surfaces'>) {
  return {
    tools: { enabled: policy.tools.length, total: ACCESS_PROFILE_TOOLS.length },
    operations: { enabled: policy.operations.length, total: ACCESS_PROFILE_OPERATIONS.length },
    surfaces: { enabled: policy.surfaces.length, total: ACCESS_PROFILE_SURFACES.length },
  };
}
