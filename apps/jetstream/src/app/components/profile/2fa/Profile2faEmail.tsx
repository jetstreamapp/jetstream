import { UserProfileAuthFactor } from '@jetstream/auth/types';
import { toggleEnableDisableAuthFactor } from '@jetstream/shared/data';
import { DropDownItem } from '@jetstream/types';
import { Badge, Card, ConfirmationModalPromise, DropDown, fireToast, Spinner } from '@jetstream/ui';
import { FunctionComponent, useMemo, useState } from 'react';

export interface Profile2faEmailProps {
  isEnabled: boolean;
  canEnable: boolean;
  canDisabled: boolean;
  onUpdate: (authFactors: UserProfileAuthFactor[]) => void;
}

export const Profile2faEmail: FunctionComponent<Profile2faEmailProps> = ({ isEnabled, canEnable, canDisabled, onUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);

  async function handleMenuAction(action: string) {
    try {
      if (action === 'disable') {
        if (
          await ConfirmationModalPromise({
            content: 'Are you sure you want to disable two-factor authentication?',
          })
        ) {
          setIsLoading(true);
          onUpdate(await toggleEnableDisableAuthFactor('2fa-email', 'disable'));
        }
      } else if (action === 'enable') {
        setIsLoading(true);
        onUpdate(await toggleEnableDisableAuthFactor('2fa-email', 'enable'));
      }
    } catch (ex) {
      fireToast({ message: 'Failed to save 2fa settings', type: 'error' });
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
      {isLoading && <Spinner />}
      <p>Enter a code sent to your email address</p>
      {!canDisabled && <p className="text-italic">This authentication factor is required for your account.</p>}
      {!canEnable && <p className="text-italic">This authentication factor is not allowed for your account.</p>}
    </Card>
  );
};
