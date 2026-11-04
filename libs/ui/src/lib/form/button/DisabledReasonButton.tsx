import { Maybe } from '@jetstream/types';
import { ButtonHTMLAttributes, forwardRef, MouseEvent, ReactNode, useId } from 'react';
import Tooltip from '../../widgets/Tooltip';
import { ariaDisabledButtonProps } from './aria-disabled-button.utils';

export interface DisabledReasonButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'onClick'> {
  disabled?: boolean;
  /**
   * Why the button is unavailable (no permission, missing input, ...). While disabled it is shown in the tooltip on
   * hover AND keyboard focus, and read as the button's accessible description.
   */
  disabledReason?: Maybe<string>;
  /** Tooltip content while the button is enabled (or disabled without a reason), e.g. its keyboard shortcut */
  tooltip?: ReactNode;
  tooltipOpenDelay?: number;
  /** Class for the tooltip's wrapper element, e.g. to restore spacing the wrapper breaks between sibling buttons */
  tooltipClassName?: string;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * An action button that explains why it is unavailable.
 *
 * A natively disabled button cannot take focus, so a reason shown only in a tooltip or `title` around it is
 * mouse-only, and a button that disables itself while its own action runs drops focus to `<body>`. This button
 * stays focusable via {@link ariaDisabledButtonProps}, opens its tooltip on focus as well as hover, and links the
 * reason to itself with `aria-describedby` (a tooltip's own description lands on its wrapper, not the button).
 *
 * The tooltip wrapper is always rendered so the button never remounts (which would drop focus) when a reason
 * appears or goes away.
 */
export const DisabledReasonButton = forwardRef<HTMLButtonElement, DisabledReasonButtonProps>(
  (
    {
      disabled,
      disabledReason,
      tooltip,
      tooltipOpenDelay,
      tooltipClassName,
      onClick,
      type = 'button',
      'aria-describedby': ariaDescribedBy,
      children,
      ...buttonProps
    },
    ref,
  ) => {
    const reasonId = useId();
    const showReason = !!disabled && !!disabledReason;
    const describedBy = [ariaDescribedBy, showReason ? reasonId : undefined].filter(Boolean).join(' ') || undefined;

    return (
      <>
        <Tooltip className={tooltipClassName} openDelay={tooltipOpenDelay} content={showReason ? disabledReason : tooltip}>
          <button ref={ref} type={type} {...buttonProps} aria-describedby={describedBy} {...ariaDisabledButtonProps(disabled, onClick)}>
            {children}
          </button>
        </Tooltip>
        {showReason && (
          <span id={reasonId} className="slds-assistive-text">
            {disabledReason}
          </span>
        )}
      </>
    );
  },
);

DisabledReasonButton.displayName = 'DisabledReasonButton';
