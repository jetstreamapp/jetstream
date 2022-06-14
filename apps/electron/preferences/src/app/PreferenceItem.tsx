import { CheckboxToggle, Grid } from '@jetstream/ui';

export interface PreferenceItemProps {
  label: string;
  subLabel: string;
  enabled: boolean;
  children?: React.ReactNode;
  onChange: (enabled: boolean) => void;
}

export function PreferenceItem({ label, subLabel, enabled, children, onChange }: PreferenceItemProps) {
  return (
    <li className="slds-item read-only">
      <Grid verticalAlign="start" align="spread">
        <Grid vertical className="slds-grow slds-p-right_large">
          <div className="slds-text-heading_small">{label}</div>
          <div>{subLabel}</div>
          {children && <div className="pt-4 pl-4">{children}</div>}
        </Grid>
        <CheckboxToggle
          id={label}
          label={label}
          // onText="All columns, even if hidden"
          // offText="Only non-hidden columns"
          hideLabel
          labelPosition="left"
          checked={enabled}
          onChange={onChange}
        />
      </Grid>
    </li>
  );
}

export default PreferenceItem;
