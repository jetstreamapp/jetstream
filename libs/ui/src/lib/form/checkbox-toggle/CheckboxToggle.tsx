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
  /**
   * Set both when the toggle reveals content below it, so screen readers announce it as
   * expanded/collapsed and can jump to what it controls. `ariaControls` is the id of the revealed
   * region, which should stay in the DOM (empty when collapsed) so the reference always resolves.
   */
  ariaExpanded?: boolean;
  ariaControls?: string;
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
  ariaExpanded,
  ariaControls,
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
      <div className={classNames('slds-grid slds-grid_vertical-align-center', labelClassname)}>
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
            aria-expanded={ariaExpanded}
            aria-controls={ariaControls}
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
