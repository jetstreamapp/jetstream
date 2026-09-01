import { getStepUpMethods, verifyStepUp } from '@jetstream/shared/data';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StepUpAuthModal } from '../StepUpAuthModal';

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  getStepUpMethods: vi.fn(),
  initStepUpChallenge: vi.fn(),
  verifyStepUp: vi.fn(),
}));

const getStepUpMethodsMock = vi.mocked(getStepUpMethods);
const verifyStepUpMock = vi.mocked(verifyStepUp);

const LOCKOUT_MESSAGE = 'Too many failed attempts. Please try again later.';

async function renderModal() {
  const onResolve = vi.fn();
  render(
    <StepUpAuthModal
      isOpen
      purpose="CHANGE_EMAIL"
      onResolve={onResolve}
      // Supplied by react-modal-promise at runtime, unused by the component itself.
      instanceId="step-up-test"
      onReject={vi.fn()}
      open
      close={vi.fn()}
    />,
  );
  // The factor list is fetched on mount - settle it before any interaction so the state update it
  // triggers is not attributed to a later, unrelated act() scope.
  await screen.findByLabelText('Password');
  return { onResolve };
}

/** Submits the password factor and waits for the rejection to finish flushing through state. */
async function submitFailedPassword() {
  const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
  fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));
  });
  return passwordInput;
}

describe('StepUpAuthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStepUpMethodsMock.mockResolvedValue({
      methods: ['password', 'email'],
      email: 'test@example.com',
    });
  });

  it('should expose the selected method as a checked radio', async () => {
    await renderModal();
    expect((screen.getByRole('radio', { name: 'Enter your password' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: 'Email me a code' }) as HTMLInputElement).checked).toBe(false);
  });

  it('should give password managers the address to match the stored credential against', async () => {
    await renderModal();
    const username = document.querySelector('input[name="username"]') as HTMLInputElement;
    expect(username.value).toEqual('test@example.com');
  });

  // The caller is already signed in and can read their own address off the profile page, so masking
  // it here would only leave them guessing which inbox the code went to.
  it('should name the destination inbox in full', async () => {
    await renderModal();
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Email me a code' }));
    });
    expect(await screen.findByLabelText('Code sent to test@example.com')).toBeTruthy();
  });

  it('should keep the modal open and keep accepting input after an ordinary failure', async () => {
    const { onResolve } = await renderModal();
    verifyStepUpMock.mockRejectedValue(new Error('Invalid password'));

    const passwordInput = await submitFailedPassword();

    expect(await screen.findByText('Invalid password')).toBeTruthy();
    expect(onResolve).not.toHaveBeenCalled();
    expect(passwordInput.disabled).toBe(false);
  });

  // Resolving as cancelled here would be swallowed by call sites, leaving the user with a modal that
  // silently vanished and an action that never ran.
  it('should surface a lockout in the modal instead of resolving as cancelled', async () => {
    const { onResolve } = await renderModal();
    verifyStepUpMock.mockRejectedValue(new Error(LOCKOUT_MESSAGE));

    await submitFailedPassword();

    expect(await screen.findByText(LOCKOUT_MESSAGE)).toBeTruthy();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('should stop accepting input once locked out', async () => {
    await renderModal();
    verifyStepUpMock.mockRejectedValue(new Error(LOCKOUT_MESSAGE));

    const passwordInput = await submitFailedPassword();

    await waitFor(() => expect(passwordInput.disabled).toBe(true));
    // aria-disabled (not native disabled) so the button keeps keyboard focus while it disables itself
    expect(screen.getByRole('button', { name: 'Verify' }).getAttribute('aria-disabled')).toBe('true');
    expect((screen.getByRole('radio', { name: 'Email me a code' }) as HTMLInputElement).disabled).toBe(true);
  });
});
