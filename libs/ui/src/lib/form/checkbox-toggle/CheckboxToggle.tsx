import { css } from '@emotion/react';
import { RightLeft } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent, HTMLAttributes } from 'react';
import HelpText from '../../widgets/HelpText';

export interface CheckboxCheckboxToggleProps {
  id: string;
  checked: boolean;
  label: string;
  labelHelp?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  labelPosition?: RightLeft;
  onText?: string;
  offText?: string;
  containerClassname?: string;
  labelClassname?: string;
  extraProps?: HTMLAttributes<HTMLDivElement>;
  onChange?: (value: boolean) => void;
}

export const CheckboxToggle: FunctionComponent<CheckboxCheckboxToggleProps> = ({
  id,
  checked,
  label,
  labelHelp,
  disabled = false,
  hideLabel = false,
  labelPosition = 'left',
  onText = 'Enabled',
  offText = 'Disabled',
  containerClassname,
  labelClassname,
  extraProps,
  onChange,
}) => {
  const stateId = `${id}-state`;
  const handleChange = () => {
    if (disabled || !onChange) {
      return;
    }
    onChange(!checked);
  };

  // Both labels point at the input, so its accessible name is the label text plus the visible
  // on/off state — the same name the single wrapping label produced. A hidden label keeps the name.
  const labelText = (
    <label
      htmlFor={id}
      className={classNames('slds-form-element__label slds-m-bottom_none', {
        'slds-assistive-text': hideLabel,
        'slds-m-left_xx-small': labelPosition === 'right',
      })}
      // SLDS styles a toggle's label through `.slds-checkbox_toggle .slds-form-element__label`. The text
      // now sits beside that element rather than inside it, so the rule is restated here — without it
      // every toggle label turned bold and muted
      css={css`
        font-weight: normal;
        color: var(--slds-g-color-on-surface-1);
      `}
    >
      {label}
    </label>
  );

  return (
    <div className={classNames('slds-form-element', containerClassname)} {...extraProps}>
      {/* HelpText renders a <button>, and a label's control is its first LABELABLE descendant — buttons
          qualify. With the help button inside the toggle's label, the label attached itself to that
          button: the checkbox lost its name and clicking the label text no longer toggled it. The
          label is therefore split around the help button, each half associated via htmlFor. */}
      {/* Top-aligned: the switch has its on/off caption beneath it, so centering the row dropped the label
          below the switch it names */}
      <div className={classNames('slds-grid slds-grid_vertical-align-start', labelClassname)}>
        {labelPosition === 'left' && labelText}
        {labelHelp && <HelpText id={`${id}-label-help-text`} className="slds-m-right_xx-small" content={labelHelp} />}
        {/* No click handlers: the label natively forwards clicks to the input, which fires a single
            change event. The previous preventDefault + manual span handlers (added to stop that
            forwarding from double-toggling) canceled the checkbox's native activation, which broke
            toggling with the Space key entirely. */}
        <label
          htmlFor={id}
          className="slds-checkbox_toggle slds-grid slds-no-flex"
          css={css`
            width: auto;
          `}
        >
          <input
            type="checkbox"
            id={id}
            name={id}
            aria-describedby={labelHelp ? `${id}-label-help-text ${stateId}` : stateId}
            checked={checked}
            disabled={disabled}
            onChange={() => handleChange()}
          />
          <span id={stateId} className="slds-checkbox_faux_container" aria-live="assertive">
            <span className="slds-checkbox_faux"></span>
            <span className="slds-checkbox_on">{onText}</span>
            <span className="slds-checkbox_off">{offText}</span>
          </span>
        </label>
        {labelPosition === 'right' && labelText}
      </div>
    </div>
  );
};

export default CheckboxToggle;
