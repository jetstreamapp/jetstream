import { OtpEnrollmentData, UserProfileAuthFactor } from '@jetstream/auth/types';
import { logger } from '@jetstream/shared/client-logger';
import {
  deleteAuthFactor,
  getOtpQrCode,
  saveOtpAuthFactor,
  StepUpCancelledError,
  toggleEnableDisableAuthFactor,
} from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { DropDownItem } from '@jetstream/types';
import { Badge, Card, ConfirmationModalPromise, DropDown, fireToast, Input, Spinner } from '@jetstream/ui';
import { useStepUpAuth } from '@jetstream/ui-core';
import { FormEvent, FunctionComponent, useCallback, useEffect, useMemo, useState } from 'react';
import { MANAGE_2FA_STEP_UP } from '../step-up-prompts';

export interface Profile2faOtpProps {
  isConfigured: boolean;
  isEnabled: boolean;
  canEnable: boolean;
  canDisabled: boolean;
  onUpdate: (authFactors: UserProfileAuthFactor[]) => void;
}

export const Profile2faOtp: FunctionComponent<Profile2faOtpProps> = ({ isConfigured, isEnabled, canEnable, canDisabled, onUpdate }) => {
  const [otp2fa, setOtp2fa] = useState<OtpEnrollmentData>();
  const [editIsActive, setEditIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState('');
  const { runWithStepUp } = useStepUpAuth();

  // Identity is verified here, when enrollment starts: the secret minted after the prompt is what the
  // save is checked against, so the code the user types is validated immediately and never expires
  // while they are busy re-authenticating.
  const get2faConfiguration = useCallback(async () => {
    try {
      setIsLoading(true);
      setOtp2fa(await runWithStepUp(({ stepUpNonce }) => getOtpQrCode(stepUpNonce), MANAGE_2FA_STEP_UP));
    } catch (ex) {
      // Dismissing the identity prompt closes the set-up form again; it is not an error to report
      setEditIsActive(false);
      if (ex instanceof StepUpCancelledError) {
        return;
      }
      logger.error('Failed to get 2fa config', ex);
      fireToast({ message: 'Failed to get configuration, please try again later.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [runWithStepUp]);

  useEffect(() => {
    if (editIsActive && !otp2fa) {
      get2faConfiguration();
    }
  }, [editIsActive, get2faConfiguration, otp2fa]);

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
            await runWithStepUp(({ stepUpNonce }) => toggleEnableDisableAuthFactor('2fa-otp', 'disable', stepUpNonce), MANAGE_2FA_STEP_UP),
          );
        }
      } else if (action === 'enable') {
        setIsLoading(true);
        onUpdate(
          await runWithStepUp(({ stepUpNonce }) => toggleEnableDisableAuthFactor('2fa-otp', 'enable', stepUpNonce), MANAGE_2FA_STEP_UP),
        );
      } else if (action === 'delete') {
        if (
          await ConfirmationModalPromise({
            content: 'Are you sure you want to delete your authenticator app configuration?',
          })
        ) {
          setIsLoading(true);
          onUpdate(await runWithStepUp(({ stepUpNonce }) => deleteAuthFactor('2fa-otp', stepUpNonce), MANAGE_2FA_STEP_UP));
        }
      }
    } catch (ex) {
      // Dismissing the identity prompt is a deliberate choice, not an error to report
      if (ex instanceof StepUpCancelledError) {
        return;
      }
      logger.error('Failed to save 2fa', ex);
      fireToast({ message: getErrorMessage(ex), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave(ev: FormEvent) {
    try {
      ev.preventDefault();
      if (!otp2fa || !twoFaCode) {
        return;
      }
      setIsLoading(true);
      onUpdate(await saveOtpAuthFactor(twoFaCode));
    } catch (ex) {
      logger.error('Failed to save 2fa', ex);
      fireToast({ message: getErrorMessage(ex), type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancel() {
    setEditIsActive(false);
    setTwoFaCode('');
    setIsLoading(false);
    // Drop the minted secret too: reopening set-up must go through the identity prompt again rather
    // than resume an abandoned enrollment that the server still honors for the enrollment TTL
    setOtp2fa(undefined);
  }

  const menuItems = useMemo(() => {
    const items: DropDownItem[] = [];
    if (isEnabled && canDisabled) {
      items.push({
        id: 'disable',
        value: 'Disable',
        trailingDivider: true,
        icon: { type: 'utility', icon: 'toggle_off', description: 'Disable' },
      });
    } else if (!isEnabled && canEnable) {
      items.push({
        id: 'enable',
        value: 'Enable',
        trailingDivider: true,
        icon: { type: 'utility', icon: 'toggle_on', description: 'Disable' },
      });
    }
    if (canDisabled) {
      items.push({ id: 'delete', value: 'Delete', icon: { type: 'utility', icon: 'delete', description: 'Delete' } });
    }
    return items;
  }, [canDisabled, canEnable, isEnabled]);

  if (!canDisabled && !canEnable) {
    return null;
  }

  return (
    <Card
      title={
        <>
          Authenticator App
          {isEnabled && (
            <Badge className="slds-m-left_x-small" type="success">
              Active
            </Badge>
          )}
        </>
      }
      className="slds-is-relative"
      actions={
        <>
          {!isConfigured && canEnable && (
            <button className="slds-button slds-button_neutral" onClick={() => setEditIsActive(true)}>
              Set Up
            </button>
          )}
          {isConfigured && !!menuItems.length && (
            <DropDown
              testId="mfa-totp-menu-button"
              dropDownClassName="slds-dropdown_actions"
              position="right"
              items={menuItems}
              onSelected={handleMenuAction}
            />
          )}
        </>
      }
    >
      {isLoading && <Spinner />}
      {!editIsActive && <p>Use a code from an authenticator app</p>}
      {!canDisabled && <p className="text-italic">This authentication factor is required for your account.</p>}
      {!canEnable && <p className="text-italic">This authentication factor is not allowed for your account.</p>}
      {editIsActive && otp2fa && (
        <form onSubmit={handleSave}>
          <h5>Scan the QR code with your authenticator app</h5>
          <img src={otp2fa.imageUri} alt="qr code" className="slds-box slds-box_xx-small" />
          <p>
            Or enter the following secret in your authenticator app: <span data-testid="totp-secret">{otp2fa.secretToken}</span>
          </p>
          <Input id="otp-code" label="Enter code">
            <input
              id="otp-code"
              className="slds-input"
              value={twoFaCode}
              required
              pattern="[0-9]{6}"
              autoComplete="off"
              onChange={(event) => setTwoFaCode(event.target.value)}
              maxLength={6}
            />
          </Input>
          <div className="slds-m-top_x-small">
            <button type="submit" className="slds-button slds-button_brand" disabled={twoFaCode?.length !== 6}>
              Save
            </button>
            <button type="button" className="slds-button" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </Card>
  );
};
