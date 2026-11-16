import type { Maybe, SyncV2Op } from '@jetstream/types';
import { isAfter } from 'date-fns/isAfter';
import { max as maxDate } from 'date-fns/max';
import { min as minDate } from 'date-fns/min';

/**
 * Conflict rules for history sync.
 *
 * Pure and dependency-free on purpose: the api applies them to incoming changes, and the client's
 * sync tests drive real client code against these same rules instead of a hand-written imitation.
 */

/** A client clock running ahead must not be able to win every future conflict */
export function clampSyncClientTime(clientTime: Date, now: Date) {
  return minDate([clientTime, now]);
}

/**
 * Client edit time of a stored row. Rows written before `clientUpdatedAt` existed were backfilled, the
 * fallbacks only cover rows written by an API instance still running the previous build.
 */
export function getSyncClientEditTime({
  clientUpdatedAt,
  deletedAt,
  updatedAt,
}: Pick<ExistingSyncRow, 'clientUpdatedAt' | 'deletedAt' | 'updatedAt'>) {
  if (deletedAt) {
    // A delete written by the previous build does not update clientUpdatedAt
    return clientUpdatedAt ? maxDate([clientUpdatedAt, deletedAt]) : deletedAt;
  }
  return clientUpdatedAt ?? updatedAt;
}

export interface ExistingSyncRow {
  key: string;
  revision: number;
  clientUpdatedAt: Date | null;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type SyncOpDecision =
  /** Write the op, stamping the row with `clientUpdatedAt` */
  | { action: 'write'; clientUpdatedAt: Date }
  /** Nothing to write and the client is already correct (deleting an existing tombstone) */
  | { action: 'noop'; revision: number }
  /** The server row is newer - the client must take it */
  | { action: 'reject' };

/**
 * Decide what to do with one client op given the row the server currently holds.
 *
 * - An edit made on top of the exact version the server holds (`baseRevision` matches) is accepted
 *   no matter what the clocks say - nothing happened in between, so there is no conflict to resolve.
 * - Otherwise both sides changed and the latest client edit time wins. Ties go to the incoming op
 *   so re-sending the same change is idempotent.
 * - The stored edit time never moves backwards, so accepting an edit from a device with a slow
 *   clock cannot let an older edit from another device win afterwards.
 */
export function resolveSyncOp(op: SyncV2Op, existing: Maybe<ExistingSyncRow>, now: Date): SyncOpDecision {
  const clientUpdatedAt = clampSyncClientTime(op.clientUpdatedAt, now);
  if (!existing) {
    return { action: 'write', clientUpdatedAt };
  }
  if (op.type === 'delete' && existing.deletedAt) {
    return { action: 'noop', revision: existing.revision };
  }
  const existingEditTime = getSyncClientEditTime(existing);
  const isBasedOnCurrentRevision = op.baseRevision != null && op.baseRevision === existing.revision;
  if (isBasedOnCurrentRevision || !isAfter(existingEditTime, clientUpdatedAt)) {
    return { action: 'write', clientUpdatedAt: maxDate([clientUpdatedAt, existingEditTime]) };
  }
  return { action: 'reject' };
}
