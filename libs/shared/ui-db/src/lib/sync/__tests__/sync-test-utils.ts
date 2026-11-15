import { ExistingSyncRow, resolveSyncOp } from '@jetstream/shared/utils';
import { QueryHistoryItem, SyncV2OpResult, SyncV2OpSchema, SyncV2Record, SyncV2Response, SyncV2ResponseSchema } from '@jetstream/types';
import { createDexieInstance, DexieDb } from '../../ui-db';
import { createSyncCaptureMiddleware } from '../sync-capture.middleware';
import { SyncEngine } from '../sync-engine';
import { SyncApi } from '../sync-store';

interface ServerRow extends ExistingSyncRow {
  entity: string;
  orgId: string | null;
  data: Record<string, unknown>;
}

/**
 * In-memory stand-in for the sync endpoints. Conflicts are decided by the same `resolveSyncOp` the
 * api uses, and everything crosses a JSON round trip like it would over HTTP.
 */
export class FakeSyncServer {
  rows = new Map<string, ServerRow>();
  revision = 0;
  pageSize = 200;
  offline = false;
  /** Keys the server reports as impossible to accept (stands in for failed validation) */
  invalidKeys = new Set<string>();
  now: () => Date = () => new Date();
  requestCount = 0;

  createApi(): SyncApi {
    return {
      sync: async (request) => this.respond(() => this.sync(JSON.parse(JSON.stringify(request)))),
      pull: async (request) => this.respond(() => this.pull(request.cursor)),
    };
  }

  liveRows() {
    return Array.from(this.rows.values()).filter(({ deletedAt }) => !deletedAt);
  }

  private respond(handler: () => SyncV2Response): SyncV2Response {
    this.requestCount++;
    if (this.offline) {
      throw new Error('Network Error');
    }
    return SyncV2ResponseSchema.parse(JSON.parse(JSON.stringify(handler())));
  }

  private toRecord({ key, entity, orgId, data, revision, clientUpdatedAt, deletedAt }: ServerRow): SyncV2Record {
    return { key, entity, orgId, data: deletedAt ? {} : data, revision, clientUpdatedAt, deleted: !!deletedAt };
  }

  private getChanges(cursor: number, maxRevision: number) {
    const rows = Array.from(this.rows.values())
      .filter(({ revision }) => revision > cursor && revision <= maxRevision)
      .sort((left, right) => left.revision - right.revision);
    const hasMore = rows.length > this.pageSize;
    return { changes: rows.slice(0, this.pageSize).map((row) => this.toRecord(row)), hasMore };
  }

  private pull(cursor: number): SyncV2Response {
    if (cursor > this.revision) {
      return { results: [], changes: [], cursor: this.revision, hasMore: false, resetRequired: true };
    }
    const { changes, hasMore } = this.getChanges(cursor, this.revision);
    return { results: [], changes, cursor: hasMore ? changes[changes.length - 1].revision : this.revision, hasMore, resetRequired: false };
  }

  private sync({ cursor, ops }: { cursor: number; ops: unknown[] }): SyncV2Response {
    if (cursor > this.revision) {
      return { results: [], changes: [], cursor: this.revision, hasMore: false, resetRequired: true };
    }
    const revisionBeforeWrites = this.revision;
    const now = this.now();
    const results = ops.map((rawOp): SyncV2OpResult => {
      const parsed = SyncV2OpSchema.safeParse(rawOp);
      if (!parsed.success || this.invalidKeys.has(parsed.data.key)) {
        return { status: 'invalid', message: 'Invalid sync operation' };
      }
      const op = parsed.data;
      const existing = this.rows.get(op.key);
      const decision = resolveSyncOp(op, existing, now);
      if (decision.action === 'noop') {
        return { status: 'accepted', revision: decision.revision };
      }
      if (decision.action === 'reject') {
        return { status: 'rejected', record: this.toRecord(existing as ServerRow) };
      }
      const revision = ++this.revision;
      this.rows.set(op.key, {
        key: op.key,
        entity: op.entity,
        orgId: op.type === 'put' ? (op.orgId ?? null) : (existing?.orgId ?? null),
        data: op.type === 'put' ? op.data : {},
        revision,
        clientUpdatedAt: decision.clientUpdatedAt,
        updatedAt: now,
        deletedAt: op.type === 'delete' ? now : null,
      });
      return { status: 'accepted', revision };
    });
    const { changes, hasMore } = this.getChanges(cursor, revisionBeforeWrites);
    return { results, changes, cursor: hasMore ? changes[changes.length - 1].revision : this.revision, hasMore, resetRequired: false };
  }
}

export interface TestDevice {
  db: DexieDb;
  engine: SyncEngine;
}

let deviceCount = 0;

/** A device = its own database + engine, with local changes captured exactly as in the app */
export function createDevice(server: FakeSyncServer, api: SyncApi = server.createApi()): TestDevice {
  const db = createDexieInstance(`sync-spec-device-${deviceCount++}`, (instance) => {
    instance.use(createSyncCaptureMiddleware(() => undefined));
  });
  return { db, engine: new SyncEngine(db, api) };
}

export function makeQueryHistoryItem(id: string, overrides: Partial<QueryHistoryItem> = {}): QueryHistoryItem {
  const date = new Date('2026-06-01T00:00:00.000Z');
  return {
    key: `qh_org1:account${id}`,
    hashedKey: `hash-${id}`,
    org: 'org1',
    sObject: 'Account',
    label: 'Account',
    soql: `SELECT Id FROM Account WHERE Name = '${id}'`,
    lastRun: date,
    createdAt: date,
    updatedAt: date,
    runCount: 1,
    isTooling: false,
    isFavorite: false,
    ...overrides,
  };
}

/** Local query history without the derived index mirror, sorted, for comparing devices */
export async function getQueryHistory({ db }: TestDevice) {
  const records = await db.query_history.orderBy('key').toArray();
  return records.map(({ isFavoriteIdx: _isFavoriteIdx, ...record }) => record);
}
