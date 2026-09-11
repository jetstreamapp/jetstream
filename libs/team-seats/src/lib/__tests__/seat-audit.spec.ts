import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createTeamAuditLog: vi.fn() }));

vi.mock('@jetstream/audit-logs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@jetstream/audit-logs')>();
  return { ...actual, createTeamAuditLog: mocks.createTeamAuditLog };
});

vi.mock('@jetstream/api-config', () => ({ prisma: {}, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }, ENV: {} }));

import { AuditLogAction, AuditLogResource } from '@jetstream/audit-logs';
import { auditSeatLimitRejection } from '../seat-audit';
import { SeatLimitError } from '../seat-enforcement';

const seats = {
  purchased: 2,
  pending: null,
  pendingEffectiveAt: null,
  effective: 2,
  used: 2,
  reserved: 0,
  available: 0,
  isUnlimited: false,
  isOverAllocated: false,
  includedSeats: 0,
};

describe('auditSeatLimitRejection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes the blocked-seat entry with the role the check was run against', () => {
    const error = new SeatLimitError({ code: 'NO_SEATS', teamId: 'team-1', kind: 'ACCEPT_INVITATION', seats, role: 'ADMIN' });

    auditSeatLimitRejection(error, {
      attemptedAction: 'ACCEPT_INVITATION',
      userId: 'user-1',
      resourceId: 'user-1',
      targetEmail: 'invitee@example.com',
      targetUserId: 'user-1',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });

    expect(mocks.createTeamAuditLog).toHaveBeenCalledWith({
      userId: 'user-1',
      teamId: 'team-1',
      action: AuditLogAction.TEAM_MEMBER_ADD_BLOCKED_NO_SEATS,
      resource: AuditLogResource.TEAM_MEMBER,
      resourceId: 'user-1',
      metadata: {
        attemptedAction: 'ACCEPT_INVITATION',
        code: 'NO_SEATS',
        kind: 'ACCEPT_INVITATION',
        targetEmail: 'invitee@example.com',
        targetUserId: 'user-1',
        role: 'ADMIN',
        seats,
      },
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
    });
  });

  it('records invitation actions against the invitation resource and omits unknown targets', () => {
    const error = new SeatLimitError({ code: 'PAST_DUE', teamId: 'team-1', kind: 'ADD', seats: null, role: 'MEMBER' });

    auditSeatLimitRejection(error, { attemptedAction: 'INVITE', userId: 'admin-1', targetEmail: 'invitee@example.com' });

    expect(mocks.createTeamAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: AuditLogResource.TEAM_INVITATION,
        metadata: {
          attemptedAction: 'INVITE',
          code: 'PAST_DUE',
          kind: 'ADD',
          targetEmail: 'invitee@example.com',
          role: 'MEMBER',
          seats: null,
        },
      }),
    );
    expect(mocks.createTeamAuditLog.mock.calls[0][0].metadata).not.toHaveProperty('targetUserId');
  });

  it('falls back to the caller-supplied role, then MEMBER, when the check did not know the role', () => {
    const error = new SeatLimitError({ code: 'NO_SEATS', teamId: 'team-1', kind: 'ADD', seats });

    auditSeatLimitRejection(error, { attemptedAction: 'SSO_JIT', targetEmail: 'a@example.com', role: 'BILLING' });
    auditSeatLimitRejection(error, { attemptedAction: 'AUTO_JOIN', targetEmail: 'b@example.com' });

    expect(mocks.createTeamAuditLog.mock.calls[0][0].metadata.role).toBe('BILLING');
    expect(mocks.createTeamAuditLog.mock.calls[1][0].metadata.role).toBe('MEMBER');
  });
});
