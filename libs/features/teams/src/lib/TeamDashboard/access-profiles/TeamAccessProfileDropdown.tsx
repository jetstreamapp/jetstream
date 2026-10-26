import { ListItem, TeamAccessProfile } from '@jetstream/types';
import { Picklist } from '@jetstream/ui';
import { useMemo } from 'react';
import { FULL_ACCESS_ID, FULL_ACCESS_LABEL } from './access-profile.utils';

interface TeamAccessProfileDropdownProps {
  label?: string;
  accessProfiles: TeamAccessProfile[];
  /** NULL is full access */
  accessProfileId: string | null;
  /** Leaves this profile out, used when choosing where to move members of a profile being deleted */
  excludeAccessProfileId?: string;
  disabled?: boolean;
  helpText?: string;
  onChange: (accessProfileId: string | null) => void;
}

export function TeamAccessProfileDropdown({
  label = 'Access Profile',
  accessProfiles,
  accessProfileId,
  excludeAccessProfileId,
  disabled,
  helpText,
  onChange,
}: TeamAccessProfileDropdownProps) {
  const items = useMemo((): ListItem[] => {
    return [
      { id: FULL_ACCESS_ID, value: FULL_ACCESS_ID, label: FULL_ACCESS_LABEL, secondaryLabel: 'Every tool and operation' },
      ...accessProfiles
        .filter(({ id }) => id !== excludeAccessProfileId)
        .map(({ id, name, description, isDefault }) => ({
          id,
          value: id,
          label: isDefault ? `${name} (default)` : name,
          secondaryLabel: description,
        })),
    ];
  }, [accessProfiles, excludeAccessProfileId]);

  return (
    <Picklist
      usePortal
      allowDeselection={false}
      label={label}
      labelHelp="Controls which Jetstream tools and actions this person sees. Your team administrators manage access profiles."
      helpText={helpText}
      items={items}
      selectedItemIds={[accessProfileId ?? FULL_ACCESS_ID]}
      onChange={(selectedItems) => {
        const [selectedItem] = selectedItems;
        onChange(!selectedItem || selectedItem.id === FULL_ACCESS_ID ? null : selectedItem.id);
      }}
      disabled={disabled}
    />
  );
}
