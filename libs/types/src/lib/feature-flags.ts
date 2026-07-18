/**
 * Lightweight feature flag system.
 *
 * Flag keys and their defaults live here in code (typed, shared FE/BE). The database only stores
 * *overrides* (deviations from the default) scoped to a user or a team via the `FeatureFlagOverride`
 * table. Resolution is "most permissive wins": for a given flag the result is true if the code
 * default, the team override, or the user override is true (see `resolveFeatureFlagsForUser` on the
 * server). If non-boolean flags are ever introduced, prefer the team value.
 *
 * To add a flag: add an entry below. To gate it to a user/team: insert a `FeatureFlagOverride` row.
 * To GA it: flip `defaultValue` to true. To retire it: remove the entry and delete its override rows.
 */
export const FEATURE_FLAGS = {
  'analysis-tools': {
    defaultValue: false,
    description: 'Data and record analysis tools.',
  },
  'salesforce-canvas': {
    defaultValue: false,
    description: 'Manage Salesforce orgs authorized to use the Canvas app.',
  },
} as const satisfies Record<string, { defaultValue: boolean; description: string }>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;
export type FeatureFlags = Record<FeatureFlagKey, boolean>;

/** Every known flag at its code-defined default. Used as the base for resolution and the client fallback. */
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = Object.fromEntries(
  Object.entries(FEATURE_FLAGS).map(([key, { defaultValue }]) => [key, defaultValue]),
) as FeatureFlags;

export const ALL_FEATURE_FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

export function isFeatureFlagKey(key: string): key is FeatureFlagKey {
  return Object.prototype.hasOwnProperty.call(FEATURE_FLAGS, key);
}

/**
 * Canonical, stable serialization of a user's resolved flags. Used by BOTH the server signer and the
 * browser verifier, so the byte sequence must be deterministic regardless of object key order or
 * which keys happen to be present. Keys are sorted and values coerced to booleans.
 */
export function serializeFeatureFlagsForSigning(userId: string, flags: FeatureFlags): string {
  const entries = [...ALL_FEATURE_FLAG_KEYS].sort().map((key) => [key, !!flags[key]] as const);
  return JSON.stringify({ userId, flags: entries });
}
