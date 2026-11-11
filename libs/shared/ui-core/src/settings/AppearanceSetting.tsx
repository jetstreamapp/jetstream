import { ColorScheme } from '@jetstream/types';
import { RadioButton, RadioGroup } from '@jetstream/ui';
import { useUserPreferenceState } from '@jetstream/ui/app-state';
import { getSettingsRowIds, SettingsRow } from './layout/SettingsSection';

const ROW_ID = 'setting-theme';

const COLOR_SCHEME_OPTIONS: { value: ColorScheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Match Device' },
];

/** Same preference as the theme options in the user menu */
export const AppearanceSetting = () => {
  const [userPreferences, setUserPreferences] = useUserPreferenceState();
  const colorScheme = userPreferences?.colorScheme ?? 'light';

  function handleChange(nextColorScheme: ColorScheme) {
    setUserPreferences({ ...userPreferences, colorScheme: nextColorScheme });
  }

  return (
    <SettingsRow
      id={ROW_ID}
      title="Theme"
      description="Dark mode is in beta. Your theme is saved on this device."
      keywords={['appearance', 'color scheme', 'light', 'dark']}
    >
      <RadioGroup idPrefix={ROW_ID} label="Theme" hideLabel ariaDescribedBy={getSettingsRowIds(ROW_ID).descriptionId} isButtonGroup>
        {COLOR_SCHEME_OPTIONS.map(({ value, label }) => (
          <RadioButton
            key={value}
            id={`setting-theme-${value}`}
            name="setting-theme"
            label={label}
            value={value}
            checked={colorScheme === value}
            onChange={(selected) => handleChange(selected as ColorScheme)}
          />
        ))}
      </RadioGroup>
    </SettingsRow>
  );
};
