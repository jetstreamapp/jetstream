import { z } from 'zod';

/** Largest number of users or teams a single bulk request may touch */
export const MAX_FEATURE_FLAG_OVERRIDE_TARGETS = 500;

export interface FeatureFlagDefinition {
  key: string;
  description: string;
  defaultValue: boolean;
}

export interface FeatureFlagSummary extends FeatureFlagDefinition {
  userOverrideCount: number;
  teamOverrideCount: number;
}

export interface FeatureFlagUserOverrideItem {
  userId: string;
  email: string;
  name: string;
  enabled: boolean;
  updatedAt: string;
  /** The user's own active team and whether it holds an override for the same flag, for context */
  teamId: string | null;
  teamName: string | null;
  teamOverride: boolean | null;
}

export interface FeatureFlagTeamOverrideItem {
  teamId: string;
  name: string;
  enabled: boolean;
  updatedAt: string;
}

export interface FeatureFlagOverrides {
  flag: FeatureFlagDefinition;
  users: FeatureFlagUserOverrideItem[];
  teams: FeatureFlagTeamOverrideItem[];
}

/** One flag as it applies to a single user or team */
export interface FeatureFlagEntityStatus extends FeatureFlagDefinition {
  /** The override stored for this user or team; null when there is none */
  override: boolean | null;
  /** Users only: the override on their active team; null when there is no active team or no override */
  teamOverride: boolean | null;
  /** What the app resolves for this user, or for a member of this team with no override of their own */
  effective: boolean;
}

export const FeatureFlagKeyParamsSchema = z.object({
  key: z.string().min(1).max(255),
});

export const FeatureFlagOverrideScopeSchema = z.enum(['user', 'team']);
export type FeatureFlagOverrideScope = z.infer<typeof FeatureFlagOverrideScopeSchema>;

/**
 * Overrides are grant-only: a flag is enabled when the default, the team override or the user
 * override is on, so "off" means removing the override rather than storing `false`.
 */
export const FeatureFlagOverrideActionSchema = z.enum(['enable', 'remove']);
export type FeatureFlagOverrideAction = z.infer<typeof FeatureFlagOverrideActionSchema>;

export const UpdateFeatureFlagOverridesRequestSchema = z.object({
  scope: FeatureFlagOverrideScopeSchema,
  ids: z.array(z.guid()).min(1).max(MAX_FEATURE_FLAG_OVERRIDE_TARGETS),
  action: FeatureFlagOverrideActionSchema,
});
export type UpdateFeatureFlagOverridesRequest = z.infer<typeof UpdateFeatureFlagOverridesRequestSchema>;

export interface UpdateFeatureFlagOverridesResult {
  /** Overrides created or changed (enable) or deleted (remove) */
  affected: number;
}
