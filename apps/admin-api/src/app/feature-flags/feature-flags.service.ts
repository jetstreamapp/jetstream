import {
  AdminSessionUser,
  FeatureFlagEntityStatus,
  FeatureFlagOverrides,
  FeatureFlagSummary,
  UpdateFeatureFlagOverridesRequest,
  UpdateFeatureFlagOverridesResult,
} from '@jetstream/admin/types';
import { prisma } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createAuditLog } from '@jetstream/audit-logs';
import {
  FEATURE_FLAGS,
  FeatureFlagKey,
  isFeatureFlagKey,
  resolveFeatureFlagValue,
  TEAM_MEMBER_STATUS_ACTIVE,
  TEAM_STATUS_ACTIVE,
} from '@jetstream/types';
import { NotFoundError, RequestMetadata } from '../utils/route.utils';

/** Overrides are few and hand-managed, so the per-flag lists are capped rather than paginated */
const OVERRIDE_LIST_LIMIT = 1000;

const FLAG_KEYS = Object.keys(FEATURE_FLAGS) as FeatureFlagKey[];

function assertFeatureFlagKey(key: string): asserts key is FeatureFlagKey {
  if (!isFeatureFlagKey(key)) {
    throw new NotFoundError(`Feature flag ${key} not found`);
  }
}

/** Same rule the app uses when resolving flags: an ACTIVE membership in an ACTIVE team */
const ACTIVE_TEAM_MEMBERSHIP_SELECT = {
  status: true,
  team: { select: { id: true, name: true, status: true } },
} as const;

function getActiveTeam(
  membership: { status: string; team: { id: string; name: string; status: string } } | null | undefined,
): { id: string; name: string } | null {
  if (membership?.status === TEAM_MEMBER_STATUS_ACTIVE && membership.team.status === TEAM_STATUS_ACTIVE) {
    return membership.team;
  }
  return null;
}

export async function listFeatureFlags(): Promise<FeatureFlagSummary[]> {
  const [userCounts, teamCounts] = await Promise.all([
    prisma.featureFlagOverride.groupBy({ by: ['key'], where: { userId: { not: null } }, _count: { _all: true } }),
    prisma.featureFlagOverride.groupBy({ by: ['key'], where: { teamId: { not: null } }, _count: { _all: true } }),
  ]);
  const userCountByKey = new Map(userCounts.map(({ key, _count }) => [key, _count._all]));
  const teamCountByKey = new Map(teamCounts.map(({ key, _count }) => [key, _count._all]));

  return FLAG_KEYS.map((key) => ({
    key,
    description: FEATURE_FLAGS[key].description,
    defaultValue: FEATURE_FLAGS[key].defaultValue,
    userOverrideCount: userCountByKey.get(key) ?? 0,
    teamOverrideCount: teamCountByKey.get(key) ?? 0,
  }));
}

export async function getFeatureFlagOverrides(key: string): Promise<FeatureFlagOverrides> {
  assertFeatureFlagKey(key);

  const [userOverrides, teamOverrides] = await Promise.all([
    prisma.featureFlagOverride.findMany({
      where: { key, userId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: OVERRIDE_LIST_LIMIT,
      select: {
        enabled: true,
        updatedAt: true,
        user: { select: { id: true, email: true, name: true, teamMembership: { select: ACTIVE_TEAM_MEMBERSHIP_SELECT } } },
      },
    }),
    prisma.featureFlagOverride.findMany({
      where: { key, teamId: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: OVERRIDE_LIST_LIMIT,
      select: { enabled: true, updatedAt: true, team: { select: { id: true, name: true } } },
    }),
  ]);

  const teamOverrideByTeamId = new Map<string, boolean>();
  for (const { team, enabled } of teamOverrides) {
    if (team) {
      teamOverrideByTeamId.set(team.id, enabled);
    }
  }

  return {
    flag: { key, description: FEATURE_FLAGS[key].description, defaultValue: FEATURE_FLAGS[key].defaultValue },
    users: userOverrides.flatMap(({ user, enabled, updatedAt }) => {
      if (!user) {
        return [];
      }
      const activeTeam = getActiveTeam(user.teamMembership);
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        enabled,
        updatedAt: updatedAt.toISOString(),
        teamId: activeTeam?.id ?? null,
        teamName: activeTeam?.name ?? null,
        teamOverride: activeTeam ? (teamOverrideByTeamId.get(activeTeam.id) ?? null) : null,
      };
    }),
    teams: teamOverrides.flatMap(({ team, enabled, updatedAt }) =>
      team ? { teamId: team.id, name: team.name, enabled, updatedAt: updatedAt.toISOString() } : [],
    ),
  };
}

function buildStatuses({
  userOverrides = new Map<string, boolean>(),
  teamOverrides = new Map<string, boolean>(),
}: {
  userOverrides?: Map<string, boolean>;
  teamOverrides?: Map<string, boolean>;
}): FeatureFlagEntityStatus[] {
  return FLAG_KEYS.map((key) => {
    const override = userOverrides.get(key) ?? null;
    const teamOverride = teamOverrides.get(key) ?? null;
    return {
      key,
      description: FEATURE_FLAGS[key].description,
      defaultValue: FEATURE_FLAGS[key].defaultValue,
      override,
      teamOverride,
      effective: resolveFeatureFlagValue(key, [override, teamOverride]),
    };
  });
}

/** Every flag as it applies to one user, including what their active team contributes */
export async function getUserFeatureFlagStatuses(userId: string): Promise<FeatureFlagEntityStatus[]> {
  const membership = await prisma.teamMember.findUnique({ where: { userId }, select: ACTIVE_TEAM_MEMBERSHIP_SELECT });
  const activeTeam = getActiveTeam(membership);

  const overrides = await prisma.featureFlagOverride.findMany({
    where: { OR: [{ userId }, ...(activeTeam ? [{ teamId: activeTeam.id }] : [])] },
    select: { key: true, enabled: true, userId: true },
  });
  const userOverrides = new Map<string, boolean>();
  const teamOverrides = new Map<string, boolean>();
  for (const { key, enabled, userId: overrideUserId } of overrides) {
    (overrideUserId ? userOverrides : teamOverrides).set(key, enabled);
  }

  return buildStatuses({ userOverrides, teamOverrides });
}

/**
 * Every flag as it applies to a team's members who have no override of their own. The team's override
 * is the primary value here, so it is reported as `override` rather than `teamOverride`.
 */
export async function getTeamFeatureFlagStatuses(teamId: string): Promise<FeatureFlagEntityStatus[]> {
  const overrides = await prisma.featureFlagOverride.findMany({ where: { teamId }, select: { key: true, enabled: true } });
  return buildStatuses({ userOverrides: new Map(overrides.map(({ key, enabled }) => [key, enabled])) });
}

export async function updateFeatureFlagOverrides(
  key: string,
  { scope, ids, action }: UpdateFeatureFlagOverridesRequest,
  admin: AdminSessionUser,
  requestMetadata: RequestMetadata,
): Promise<UpdateFeatureFlagOverridesResult> {
  assertFeatureFlagKey(key);
  const targetIds = Array.from(new Set(ids));
  const targetColumn = scope === 'user' ? 'userId' : 'teamId';

  // Fail with a 404 instead of a foreign key error when any selected row has since been deleted
  const existingCount =
    scope === 'user'
      ? await prisma.user.count({ where: { id: { in: targetIds } } })
      : await prisma.team.count({ where: { id: { in: targetIds } } });
  if (existingCount !== targetIds.length) {
    throw new NotFoundError(`${targetIds.length - existingCount} of the selected ${scope === 'user' ? 'users' : 'teams'} no longer exist`);
  }

  const affected = await prisma.$transaction(async (tx) => {
    if (action === 'remove') {
      const { count } = await tx.featureFlagOverride.deleteMany({ where: { key, [targetColumn]: { in: targetIds } } });
      return count;
    }
    const { count: created } = await tx.featureFlagOverride.createMany({
      data: targetIds.map((id) => ({ key, [targetColumn]: id, enabled: true })),
      skipDuplicates: true,
    });
    // Rows saved as disabled are left over from before the admin app; turn them on instead of skipping them
    const { count: reenabled } = await tx.featureFlagOverride.updateMany({
      where: { key, [targetColumn]: { in: targetIds }, enabled: false },
      data: { enabled: true },
    });
    return created + reenabled;
  });

  await createAuditLog({
    action: action === 'enable' ? AuditLogAction.ADMIN_FEATURE_FLAG_OVERRIDES_ENABLED : AuditLogAction.ADMIN_FEATURE_FLAG_OVERRIDES_REMOVED,
    resource: AuditLogResource.FEATURE_FLAG,
    resourceId: key,
    metadata: { adminEmail: admin.email, scope, ids: targetIds, affected },
    ...requestMetadata,
  });

  return { affected };
}
