import { TeamMemberRole, TeamMemberRoleSchema } from '@jetstream/types';
import { classNames } from '../utils/class-names';

export const TEAM_ROLE_LABELS: Record<TeamMemberRole, string> = {
  ADMIN: 'Admin',
  MEMBER: 'Member',
  BILLING: 'Billing (no seat)',
};

export function TeamRoleSelect({
  value,
  onChange,
  label = 'Role',
  className,
}: {
  value: TeamMemberRole;
  onChange: (role: TeamMemberRole) => void;
  label?: string;
  className?: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as TeamMemberRole)}
      className={classNames(
        'rounded-md border-0 py-1.5 pr-8 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-blue-600 focus:ring-inset',
        className,
      )}
    >
      {TeamMemberRoleSchema.options.map((roleOption) => (
        <option key={roleOption} value={roleOption}>
          {TEAM_ROLE_LABELS[roleOption]}
        </option>
      ))}
    </select>
  );
}
