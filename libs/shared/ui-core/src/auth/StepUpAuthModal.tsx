import type { StepUpMethod, StepUpPurpose } from '@jetstream/auth/types';
import { getStepUpMethods, initStepUpChallenge, verifyStepUp } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { ariaDisabledButtonProps, Input, Modal, Radio, RadioGroup, ScopedNotification, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { create, InstanceProps } from 'react-modal-promise';

export type StepUpResult = { cancelled: true } | { cancelled: false; stepUpNonce: string };

const METHOD_LABEL: Record<StepUpMethod, string> = {
  password: 'Enter your password',
  '2fa-otp': 'Use your authenticator app',
  email: 'Email me a code',
};

const RESEND_COOLDOWN_SECONDS = 30;

export interface StepUpAuthModalProps extends InstanceProps<StepUpResult, never> {
  isOpen: boolean;
  purpose: StepUpPurpose;
  header?: string;
  description?: React.ReactNode;
  onResolve: (result: StepUpResult) => void;
}

export const StepUpAuthModal: FunctionComponent<StepUpAuthModalProps> = ({
  isOpen,
  purpose,
  header = "Confirm it's you",
  description = 'For your security, verify your identity before making this change.',
  onResolve,
}) => {
  const [methods, setMethods] = useState<StepUpMethod[]>([]);
  const [email, setEmail] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<StepUpMethod | null>(null);
  const [value, setValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Focus the code input once, when the modal first shows it — NOT every time the verification method
  // changes: the inputs remount per method, and an autoFocus there yanked focus out of the radio group
  // while the user was still arrowing through the choices
  const initialFocusDone = useRef(false);
  const focusOnFirstMount = (element: HTMLInputElement | null) => {
    if (element && !initialFocusDone.current) {
      initialFocusDone.current = true;
      element.focus();
    }
  };
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Guards the auto-send effect from firing twice under StrictMode's double-invoke.
  const emailChallengeSentRef = useRef(false);

  // The factor list is always fetched here rather than carried on the 403 that opened the prompt,
  // so there is exactly one source of truth for which factors this user can actually complete.
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    getStepUpMethods()
      .then(({ methods, email }) => {
        if (!isMounted) {
          return;
        }
        setMethods(methods);
        setEmail(email);
        setSelectedMethod((existing) => existing ?? methods[0] ?? null);
      })
      .catch((ex) => isMounted && setErrorMessage(getErrorMessage(ex)))
      .finally(() => isMounted && setIsLoading(false));
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setResendCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const sendEmailChallenge = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await initStepUpChallenge();
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (ex) {
      // Nothing was sent, so let the auto-send fire again if the user leaves the email method and
      // comes back. A successful send deliberately stays latched - see the effect below.
      emailChallengeSentRef.current = false;
      setErrorMessage(getErrorMessage(ex));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Send the code as soon as the email method is in play, so the field is never waiting on a
  // separate "send" click the user has to discover. The ref latches for the modal's lifetime rather
  // than per selection: the code from the first send is still valid, and re-sending on every toggle
  // back would hand the user an unlimited-mail button that sidesteps the resend cooldown.
  useEffect(() => {
    if (selectedMethod !== 'email' || emailChallengeSentRef.current) {
      return;
    }
    emailChallengeSentRef.current = true;
    void sendEmailChallenge();
  }, [selectedMethod, sendEmailChallenge]);

  function handleSelectMethod(method: StepUpMethod) {
    setSelectedMethod(method);
    setValue('');
    setErrorMessage(null);
  }

  /**
   * Kept free of any event argument because it is driven from two places that pass different events:
   * the form's onSubmit (Enter in the input) and the footer button's onClick. The footer is rendered
   * outside the form by Modal, so the button cannot rely on submit semantics.
   */
  async function submitStepUp() {
    if (!selectedMethod) {
      return;
    }
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { stepUpNonce } = await verifyStepUp({
        purpose,
        method: selectedMethod,
        ...(selectedMethod === 'password' ? { password: value } : { code: value }),
      });
      onResolve({ cancelled: false, stepUpNonce });
    } catch (ex) {
      const message = getErrorMessage(ex);
      // The lockout is session-wide and lasts several minutes, so every factor is spent - stop
      // accepting input, but leave the modal open so the user reads why. Auto-closing here would be
      // indistinguishable from a cancel to the caller, which swallows cancels silently.
      //
      // The match is deliberately loose enough to also catch the verify limiter's 429 ("Too many
      // requests..."): that limiter runs for the same 15 minutes as the lockout, so leaving the form
      // enabled would only let the user hammer Verify into a wall of rejections. The banner shows the
      // server's own message either way, so the two remain distinguishable to the user.
      if (/too many/i.test(message)) {
        setIsLockedOut(true);
      }
      setErrorMessage(message);
      setValue('');
      setIsLoading(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  const isCodeMethod = selectedMethod === '2fa-otp' || selectedMethod === 'email';
  const canSubmit = !isLoading && !isLockedOut && (isCodeMethod ? value.length === 6 : value.length > 0);

  return (
    <Modal
      testId="step-up-auth-modal"
      header={header}
      // Dismissing mid-flow by accident means starting the whole sensitive action over.
      closeOnEsc={false}
      closeOnBackdropClick={false}
      footer={
        <Fragment>
          <button className="slds-button slds-button_neutral" onClick={() => onResolve({ cancelled: true })}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" {...ariaDisabledButtonProps(!canSubmit, submitStepUp)} type="button">
            Verify
          </button>
        </Fragment>
      }
      onClose={() => onResolve({ cancelled: true })}
    >
      {/*
        slds-is-relative scopes the spinner overlay to this content area. Without a positioned
        ancestor it resolves against .slds-modal (position:fixed, inset:0) and covers the entire
        viewport at z-index 9050 - above the modal itself - which blocks the footer buttons while
        any request is in flight. The Verify button is already disabled while isLoading, so the
        footer does not need covering.
      */}
      <div className="slds-is-relative">
        {isLoading && <Spinner />}
        <p className="slds-m-bottom_small">{description}</p>

        {errorMessage && (
          <ScopedNotification theme="error" className="slds-m-bottom_small">
            {errorMessage}
          </ScopedNotification>
        )}

        {/*
          Stacked radios rather than a button group: the labels are full sentences and the default
          modal is only 30rem wide, so a segmented control would overflow once a third factor is
          available.
        */}
        {methods.length > 1 && (
          <RadioGroup className="slds-m-bottom_small" label="How would you like to verify?">
            {methods.map((method) => (
              <Radio
                key={method}
                id={`step-up-method-${method}`}
                name="step-up-method"
                label={METHOD_LABEL[method]}
                value={method}
                checked={method === selectedMethod}
                disabled={isLockedOut}
                onChange={() => handleSelectMethod(method)}
              />
            ))}
          </RadioGroup>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitStepUp();
          }}
        >
          {selectedMethod === 'password' && (
            <Fragment>
              {/* Hidden username field so password managers can associate the stored credential. */}
              {email && <input type="text" name="username" autoComplete="username" className="slds-hide" readOnly value={email} />}
              <Input id="step-up-password" label="Password">
                <input
                  id="step-up-password"
                  className="slds-input"
                  type="password"
                  autoComplete="current-password"
                  ref={focusOnFirstMount}
                  required
                  disabled={isLockedOut}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </Input>
            </Fragment>
          )}

          {selectedMethod === '2fa-otp' && (
            <Input id="step-up-code" label="Code from your authenticator app">
              <input
                id="step-up-code"
                className="slds-input"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                ref={focusOnFirstMount}
                required
                disabled={isLockedOut}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </Input>
          )}

          {selectedMethod === 'email' && (
            <Fragment>
              <Input id="step-up-code" label={`Code sent to ${email || 'your email address'}`}>
                <input
                  id="step-up-code"
                  className="slds-input"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoComplete="one-time-code"
                  ref={focusOnFirstMount}
                  required
                  disabled={isLockedOut}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </Input>
              <button
                type="button"
                className="slds-button slds-m-top_x-small"
                disabled={isLoading || isLockedOut || resendCooldown > 0}
                onClick={sendEmailChallenge}
              >
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
              </button>
            </Fragment>
          )}
        </form>
      </div>
    </Modal>
  );
};

export const StepUpAuthModalPromise = create<StepUpAuthModalProps, StepUpResult, never>(StepUpAuthModal);
