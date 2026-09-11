import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import { TEAM_MEMBER_ROLE_MEMBER } from '@jetstream/types';
import { SeatLimitError } from './seat-enforcement';

/** Every membership path that can be refused for lack of a seat, recorded as `attemptedAction` on the audit entry. */
export type SeatBlockedAction =
  | 'INVITE'
  | 'RESEND_INVITATION'
  | 'ROLE_CHANGE'
  | 'REACTIVATE'
  | 'ACCEPT_INVITATION'
  | 'ACCEPT_INVITATION_ON_LOGIN'
  | 'AUTO_JOIN'
  | 'SSO_JIT';

const INVITATION_ACTIONS = new Set<SeatBlockedAction>(['INVITE', 'RESEND_INVITATION']);

export interface SeatLimitRejectionContext {
  attemptedAction: SeatBlockedAction;
  /** The user performing the action; absent for self-service flows such as signup auto-join */
  userId?: string;
  resourceId?: string;
  targetEmail?: string;
  targetUserId?: string;
  /** Used when the seat check did not know the role it was granting */
  role?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Records a membership change that was refused for lack of a seat so admins can see who was turned
 * away in the team audit log. Every blocked path writes the same entry through here so the metadata
 * shape cannot drift between the dashboard, login and SSO flows. Fire-and-forget: the caller still
 * surfaces or rethrows the error itself.
 */
export function auditSeatLimitRejection(error: SeatLimitError, context: SeatLimitRejectionContext): void {
  const { attemptedAction, userId, resourceId, targetEmail, targetUserId, role, ipAddress, userAgent } = context;
  createTeamAuditLog({
    userId,
    teamId: error.teamId,
    action: AuditLogAction.TEAM_MEMBER_ADD_BLOCKED_NO_SEATS,
    resource: INVITATION_ACTIONS.has(attemptedAction) ? AuditLogResource.TEAM_INVITATION : AuditLogResource.TEAM_MEMBER,
    resourceId,
    metadata: {
      attemptedAction,
      code: error.code,
      kind: error.kind,
      ...(targetEmail ? { targetEmail } : {}),
      ...(targetUserId ? { targetUserId } : {}),
      role: error.role ?? role ?? TEAM_MEMBER_ROLE_MEMBER,
      seats: error.seats,
    },
    ipAddress,
    userAgent,
  });
}
