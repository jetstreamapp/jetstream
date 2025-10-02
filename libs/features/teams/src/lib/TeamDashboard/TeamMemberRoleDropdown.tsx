import { TeamMemberRole } from '@jetstream/types';
import { Picklist } from '@jetstream/ui';

interface TeamMemberRoleDropdownProps {
  label?: string;
  role: TeamMemberRole;
  disabled: boolean;
  onChange: (role: TeamMemberRole) => void;
}

export function TeamMemberRoleDropdown({ label = 'Role', role, disabled, onChange }: TeamMemberRoleDropdownProps) {
  return (
    <Picklist
      allowDeselection={false}
      label={label}
      className="slds-button_last"
      items={[
        { id: 'MEMBER', value: 'ADMIN', label: 'Member' },
        { id: 'BILLING', value: 'ADMIN', label: 'Billing' },
        { id: 'ADMIN', value: 'ADMIN', label: 'Admin' },
      ]}
      selectedItemIds={[role]}
      onChange={(role) => onChange(role[0].id as TeamMemberRole)}
      disabled={disabled}
    />
  );
}
