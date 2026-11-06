import { UserProfileAuthFactor } from '@jetstream/auth/types';
import { StepUpCancelledError, toggleEnableDisableAuthFactor } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DropDownItem } from '@jetstream/types';
import { Badge, Card, ConfirmationModalPromise, DropDown, fireToast, Spinner } from '@jetstream/ui';
import { useStepUpAuth } from '@jetstream/ui-core';
import { FunctionComponent, useMemo, useState } from 'react';
import { MANAGE_2FA_STEP_UP } from '../step-up-prompts';

export interface Profile2faEmailProps {
  isEnabled: boolean;
  canEnable: boolean;
  canDisabled: boolean;
  onUpdate: (authFactors: UserProfileAuthFactor[]) => void;
}

export const Profile2faEmail: FunctionComponent<Profile2faEmailProps> = ({ isEnabled, canEnable, canDisabled, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { runWithStepUp, isPrompting } = useStepUpAuth();

  async function handleMenuAction(action: string) {
    try {
      if (action === 'disable') {
        if (
          await ConfirmationModalPromise({
            content: 'Are you sure you want to disable two-factor authentication?',
          })
        ) {
          setIsLoading(true);
          onUpdate(
            await runWithStepUp(
              ({ stepUpNonce }) => toggleEnableDisableAuthFactor('2fa-email', 'disable', stepUpNonce),
              MANAGE_2FA_STEP_UP,
            ),
          );
        }
      } else if (action === 'enable') {
        // No identity prompt: email codes go to the account's own address, so turning them on gives
        // someone holding a stolen session nothing new
        setIsLoading(true);
        onUpdate(await toggleEnableDisableAuthFactor('2fa-email', 'enable'));
      }
    } catch (ex) {
      // Dismissing the identity prompt is a deliberate choice, not an error to report
      if (ex instanceof StepUpCancelledError) {
        return;
      }
      fireToast({ message: getErrorMessage(ex), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  const menuItems = useMemo(() => {
    const items: DropDownItem[] = [];
    if (isEnabled) {
      items.push({
        id: 'disable',
        value: 'Disable',
        icon: { type: 'utility', icon: 'toggle_off', description: 'Disable' },
      });
    } else {
      items.push({
        id: 'enable',
        value: 'Enable',
        icon: { type: 'utility', icon: 'toggle_on', description: 'Disable' },
      });
    }
    return items;
  }, [isEnabled]);

  if (!canDisabled && !canEnable) {
    return null;
  }

  return (
    <Card
      title={
        <>
          Email
          {isEnabled && (
            <Badge className="slds-m-left_x-small" type="success">
              Active
            </Badge>
          )}
        </>
      }
      className="slds-is-relative"
      actions={
        <DropDown
          testId="mfa-email-menu-button"
          dropDownClassName="slds-dropdown_actions"
          position="right"
          items={menuItems}
          onSelected={handleMenuAction}
        />
      }
    >
      {isLoading && !isPrompting && <Spinner />}
      <p>Enter a code sent to your email address</p>
      {!canDisabled && <p className="text-italic">This authentication factor is required for your account.</p>}
      {!canEnable && <p className="text-italic">This authentication factor is not allowed for your account.</p>}
    </Card>
  );
};
