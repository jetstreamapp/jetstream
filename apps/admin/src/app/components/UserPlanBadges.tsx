import { UserListItem } from '@jetstream/admin/types';
import { TEAM_BILLING_STATUS_PAST_DUE } from '@jetstream/types';
import { Badge } from './Badge';

export const USER_PLAN_LABELS = {
  TEAM: 'Team',
  PRO: 'Professional',
  FREE: 'Free',
} as const;

export function UserPlanBadges({
  isActiveTeamMember,
  teamBillingStatus,
  hasPersonalSubscription,
}: Pick<UserListItem, 'isActiveTeamMember' | 'teamBillingStatus' | 'hasPersonalSubscription'>) {
  if (!isActiveTeamMember && !hasPersonalSubscription) {
    return <Badge>{USER_PLAN_LABELS.FREE}</Badge>;
  }
  const isTeamPastDue = teamBillingStatus === TEAM_BILLING_STATUS_PAST_DUE;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {isActiveTeamMember && (
        <Badge tone={isTeamPastDue ? 'amber' : 'blue'} title={`Team billing status: ${teamBillingStatus}`}>
          {USER_PLAN_LABELS.TEAM}
          {isTeamPastDue && ' · past due'}
        </Badge>
      )}
      {hasPersonalSubscription && <Badge tone="green">{USER_PLAN_LABELS.PRO}</Badge>}
    </span>
  );
}
