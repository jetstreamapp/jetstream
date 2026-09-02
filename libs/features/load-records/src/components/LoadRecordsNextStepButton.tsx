import { ariaDisabledButtonProps, getAriaKeyshortcuts, getModifierKey, Icon, KeyboardShortcut, Spinner, Tooltip } from '@jetstream/ui';
import { useId } from 'react';

export interface LoadRecordsNextStepButtonProps {
  label: string;
  /** Why the current step cannot advance yet; null once the step is complete */
  blockedReason: string | null;
  /** Disabled for something the user cannot act on (a load in progress) — no reason is exposed */
  disabled?: boolean;
  loadingFields?: boolean;
  onClick: () => void;
}

/**
 * The step-advancing button stays focusable while blocked (`aria-disabled`, never native `disabled`)
 * so keyboard and screen reader users can reach it and learn what still needs to be done. The reason
 * is shown as a tooltip on hover/focus for sighted users and, because the tooltip only exists while
 * open, is also mirrored in a hidden element referenced as the button's accessible description.
 */
export const LoadRecordsNextStepButton = ({ label, blockedReason, disabled, loadingFields, onClick }: LoadRecordsNextStepButtonProps) => {
  const blockedReasonId = useId();
  const isBlocked = !!blockedReason;
  const shortcutKeys = [getModifierKey(), 'enter'];

  return (
    <>
      <Tooltip
        openDelay={500}
        content={
          isBlocked ? (
            blockedReason
          ) : (
            <div className="slds-p-bottom_small">
              <KeyboardShortcut inverse keys={shortcutKeys} />
            </div>
          )
        }
      >
        <button
          data-testid="next-step-button"
          className="slds-button slds-button_brand slds-is-relative"
          aria-keyshortcuts={getAriaKeyshortcuts(shortcutKeys)}
          aria-describedby={isBlocked ? blockedReasonId : undefined}
          {...ariaDisabledButtonProps(isBlocked || disabled, onClick)}
        >
          {label}
          <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
          {loadingFields && <Spinner size="small" />}
        </button>
      </Tooltip>
      {isBlocked && (
        <span id={blockedReasonId} className="slds-assistive-text">
          {blockedReason}
        </span>
      )}
    </>
  );
};

export default LoadRecordsNextStepButton;
