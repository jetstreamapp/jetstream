import { prisma } from '@jetstream/api-config';
import { Prisma } from '@jetstream/prisma';
import {
  BILLABLE_ROLES,
  TEAM_BILLING_STATUS_PAST_DUE,
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamSeatCheckKind,
  TeamSeatLimitErrorCode,
  TeamSeatSummary,
} from '@jetstream/types';
import { evaluateSeatCheck, summarizeSeats } from './seat-math';

export type SeatDbClient = Prisma.TransactionClient | typeof prisma;

const BILLABLE_ROLE_LIST = Array.from(BILLABLE_ROLES);
const DEFAULT_LOCK_TIMEOUT_MS = 15_000;

const SEAT_LIMIT_MESSAGES: Record<TeamSeatLimitErrorCode, string> = {
  NO_SEATS: 'Your team has no available seats. Purchase more seats, deactivate a user, or cancel a pending invitation.',
  PAST_DUE: 'Your account is past-due. New users cannot be added until billing is resolved.',
};

/** Thrown when a membership change needs a seat the team does not have. Mapped to a 400 by the API. */
export class SeatLimitError extends Error {
  readonly code: TeamSeatLimitErrorCode;
  readonly teamId: string;
  readonly kind: TeamSeatCheckKind;
  readonly seats: TeamSeatSummary | null;

  constructor({
    code,
    teamId,
    kind,
    seats,
  }: {
    code: TeamSeatLimitErrorCode;
    teamId: string;
    kind: TeamSeatCheckKind;
    seats: TeamSeatSummary | null;
  }) {
    super(SEAT_LIMIT_MESSAGES[code]);
    this.name = 'SeatLimitError';
    this.code = code;
    this.teamId = teamId;
    this.kind = kind;
    this.seats = seats;
  }
}

/**
 * Serializes every seat-consuming write for a team on its row lock. Taking the lock before counting
 * means two concurrent invites cannot both see the last free seat.
 */
export async function lockTeamForSeatChange(tx: Prisma.TransactionClient, teamId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "team" WHERE "id" = ${teamId}::uuid FOR UPDATE`;
}

/**
 * ReadCommitted rather than Serializable on purpose: each statement takes a fresh snapshot, so counts
 * taken after the lock is acquired see every committed write. Under Serializable the snapshot would be
 * fixed before the lock wait and correctness would rest on serialization failures plus a retry loop.
 */
export async function withTeamSeatLock<T>(
  teamId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { timeout?: number } = {},
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await lockTeamForSeatChange(tx, teamId);
      return fn(tx);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: options.timeout ?? DEFAULT_LOCK_TIMEOUT_MS },
  );
}

export interface TeamSeatContext {
  billingStatus: string;
  manualBilling: boolean;
  seats: TeamSeatSummary;
}

/**
 * Counts seat usage straight from the database. `excludeUserId` leaves out a member whose own role or
 * status is being changed, so a seat-neutral change is never rejected because that member is counted.
 */
export async function getTeamSeatSummary(
  db: SeatDbClient,
  { teamId, excludeUserId, now = new Date() }: { teamId: string; excludeUserId?: string; now?: Date },
): Promise<TeamSeatContext> {
  const team = await db.team.findUniqueOrThrow({
    where: { id: teamId },
    select: {
      billingStatus: true,
      billingAccount: {
        select: {
          manualBilling: true,
          licenseCountLimit: true,
          pendingSeatQuantity: true,
          pendingSeatEffectiveAt: true,
          includedSeats: true,
        },
      },
    },
  });
  const usedSeats = await db.teamMember.count({
    where: {
      teamId,
      status: TEAM_MEMBER_STATUS_ACTIVE,
      role: { in: BILLABLE_ROLE_LIST },
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
  });
  const reservedSeats = await db.teamMemberInvitation.count({
    where: { teamId, role: { in: BILLABLE_ROLE_LIST }, expiresAt: { gte: now } },
  });

  return {
    billingStatus: team.billingStatus,
    manualBilling: team.billingAccount?.manualBilling ?? false,
    seats: summarizeSeats({
      // A null limit reads as uncapped on purpose. It is the state of every team until the seat
      // backfill runs, and of a brand-new team between checkout and its first Stripe sync. Failing
      // closed here would lock a paying team out of adding anyone over a sync hiccup.
      purchasedSeats: team.billingAccount?.licenseCountLimit ?? null,
      pendingSeats: team.billingAccount?.pendingSeatQuantity ?? null,
      pendingEffectiveAt: team.billingAccount?.pendingSeatEffectiveAt ?? null,
      usedSeats,
      reservedSeats,
      includedSeats: team.billingAccount?.includedSeats ?? null,
    }),
  };
}

/** Throws SeatLimitError when the team is past due or the requested kind of addition has no seat. */
export async function assertSeatAvailable(
  db: SeatDbClient,
  { teamId, kind, excludeUserId }: { teamId: string; kind: TeamSeatCheckKind; excludeUserId?: string },
): Promise<TeamSeatSummary> {
  const { billingStatus, seats } = await getTeamSeatSummary(db, { teamId, excludeUserId });
  if (billingStatus === TEAM_BILLING_STATUS_PAST_DUE) {
    throw new SeatLimitError({ code: 'PAST_DUE', teamId, kind, seats });
  }
  const result = evaluateSeatCheck(seats, kind);
  if (!result.ok) {
    throw new SeatLimitError({ code: result.code, teamId, kind, seats });
  }
  return seats;
}

/** Non-throwing variant for flows that degrade gracefully, such as domain auto-join at signup. */
export async function checkSeatAvailability(
  db: SeatDbClient,
  params: { teamId: string; kind: TeamSeatCheckKind; excludeUserId?: string },
): Promise<{ ok: true; seats: TeamSeatSummary } | { ok: false; error: SeatLimitError }> {
  try {
    return { ok: true, seats: await assertSeatAvailable(db, params) };
  } catch (ex) {
    if (ex instanceof SeatLimitError) {
      return { ok: false, error: ex };
    }
    throw ex;
  }
}
