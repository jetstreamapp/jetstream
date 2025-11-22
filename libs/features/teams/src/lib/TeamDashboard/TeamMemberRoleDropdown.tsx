import {
  ListItem,
  TEAM_MEMBER_ROLE_ACCESS,
  TEAM_MEMBER_ROLE_ADMIN,
  TEAM_MEMBER_ROLE_BILLING,
  TEAM_MEMBER_ROLE_MEMBER,
  TeamMemberRole,
} from '@jetstream/types';
import { Picklist } from '@jetstream/ui';
import { useMemo } from 'react';

interface TeamMemberRoleDropdownProps {
  label?: string;
  role: TeamMemberRole;
  disabled: boolean;
  limitBasedOnCurrentRole?: TeamMemberRole;
  onChange: (role: TeamMemberRole) => void;
}

const ROLES: ListItem[] = [
  { id: TEAM_MEMBER_ROLE_ADMIN, value: TEAM_MEMBER_ROLE_ADMIN, label: 'Admin' },
  { id: TEAM_MEMBER_ROLE_BILLING, value: TEAM_MEMBER_ROLE_BILLING, label: 'Billing' },
  { id: TEAM_MEMBER_ROLE_MEMBER, value: TEAM_MEMBER_ROLE_MEMBER, label: 'Member' },
];

export function TeamMemberRoleDropdown({ label = 'Role', role, disabled, limitBasedOnCurrentRole, onChange }: TeamMemberRoleDropdownProps) {
  const roleOptions = useMemo((): ListItem[] => {
    if (!limitBasedOnCurrentRole) {
      return ROLES;
    }
    const allowedRoleUpdates = new Set((TEAM_MEMBER_ROLE_ACCESS[limitBasedOnCurrentRole] || []) as TeamMemberRole[]);
    return ROLES.filter((role) => allowedRoleUpdates.has(role.id as TeamMemberRole));
  }, [limitBasedOnCurrentRole]);

  return (
    <Picklist
      allowDeselection={false}
      label={label}
      items={roleOptions}
      selectedItemIds={[role]}
      onChange={(role) => onChange(role[0].id as TeamMemberRole)}
      disabled={disabled}
    />
  );
}
