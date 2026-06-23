import { prisma } from '@jetstream/api-config';
import {
  DEFAULT_FEATURE_FLAGS,
  FeatureFlagKey,
  FeatureFlags,
  isFeatureFlagKey,
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamStatusSchema,
} from '@jetstream/types';

/**
 * Resolve the effective feature flags for a user.
 *
 * Starts from the code-defined defaults, then applies any DB overrides scoped to the user or their
 * team. Resolution is "most permissive wins": a flag is enabled if the default OR any matching
 * override is enabled. Override rows whose key is no longer defined in code are ignored (drift-safe).
 * Always returns the full set of known flags.
 */
export async function resolveFeatureFlagsForUser({ userId, teamId }: { userId: string; teamId?: string | null }): Promise<FeatureFlags> {
  const result: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };

  const overrides = await prisma.featureFlagOverride.findMany({
    where: { OR: [{ userId }, ...(teamId ? [{ teamId }] : [])] },
    select: { key: true, enabled: true },
  });

  for (const { key, enabled } of overrides) {
    if (isFeatureFlagKey(key)) {
      result[key] = result[key] || enabled === true;
    }
  }

  return result;
}

/**
 * Canonical "active team" used for flag scoping: an ACTIVE membership in an ACTIVE team. The /api/me
 * profile path (`findIdByUserIdUserFacing`) applies the same rule in-memory off its already-loaded
 * membership, so the flags shown in the UI and the server-side gate always agree on the team.
 */
export async function resolveActiveTeamIdForUser(userId: string): Promise<string | null> {
  const membership = await prisma.teamMember.findFirst({
    select: { teamId: true },
    where: { userId, status: TEAM_MEMBER_STATUS_ACTIVE, team: { status: TeamStatusSchema.enum.ACTIVE } },
  });
  return membership?.teamId ?? null;
}

/**
 * Authoritative server-side check for a single flag. Use this to enforce a gate on a dedicated API
 * endpoint (mirrors `checkUserEntitlement`). Most of the UI hits generic endpoints, so this is only
 * useful for the rare feature with its own server route.
 */
export async function checkFeatureFlag({ userId, key }: { userId: string; key: FeatureFlagKey }): Promise<boolean> {
  const teamId = await resolveActiveTeamIdForUser(userId);
  const flags = await resolveFeatureFlagsForUser({ userId, teamId });
  return flags[key];
}
