import { StepUpRequiredError } from '@jetstream/shared/data';
import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StepUpResult } from '../StepUpAuthModal';
import { useStepUpAuth } from '../useStepUpAuth';

const modalMock = vi.hoisted(() => ({ StepUpAuthModalPromise: vi.fn() }));
vi.mock('../StepUpAuthModal', () => modalMock);

const PROMPT = { purpose: 'MANAGE_2FA' as const };

function grantResult(stepUpNonce: string, expiresInMs = 60_000): StepUpResult {
  return { cancelled: false, stepUpNonce, expiresAt: new Date(Date.now() + expiresInMs).toISOString() };
}

/** Behaves like a protected route: rejects anything but the expected nonce with the step-up 403 */
function protectedAction(acceptedNonce: () => string | undefined) {
  return vi.fn(async ({ stepUpNonce }: { stepUpNonce?: string }) => {
    if (!stepUpNonce || stepUpNonce !== acceptedNonce()) {
      throw new StepUpRequiredError('Please verify your identity to continue');
    }
    return 'done';
  });
}

describe('useStepUpAuth', () => {
  function renderStepUpHook() {
    return renderHook(() => useStepUpAuth());
  }

  beforeEach(() => {
    modalMock.StepUpAuthModalPromise.mockReset();
    // The grant lives in module memory across tests - jumping the clock a day expires whatever the
    // previous test left behind
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should reuse the grant for the next change instead of prompting again', async () => {
    modalMock.StepUpAuthModalPromise.mockResolvedValue(grantResult('nonce-1'));
    const { result } = renderStepUpHook();
    const action = protectedAction(() => 'nonce-1');

    await act(() => result.current.runWithStepUp(action, PROMPT));
    await act(() => result.current.runWithStepUp(action, PROMPT));

    expect(modalMock.StepUpAuthModalPromise).toHaveBeenCalledTimes(1);
    // First change: attempt without a grant, then retry with the new one. Second change: grant sent up front.
    expect(action.mock.calls.map(([{ stepUpNonce }]) => stepUpNonce)).toEqual([undefined, 'nonce-1', 'nonce-1']);
  });

  it('should prompt again once the grant has expired', async () => {
    modalMock.StepUpAuthModalPromise.mockResolvedValueOnce(grantResult('nonce-1', -1)).mockResolvedValueOnce(grantResult('nonce-2'));
    let acceptedNonce = 'nonce-1';
    const { result } = renderStepUpHook();
    const action = protectedAction(() => acceptedNonce);

    await act(() => result.current.runWithStepUp(action, PROMPT));
    acceptedNonce = 'nonce-2';
    await act(() => result.current.runWithStepUp(action, PROMPT));

    expect(modalMock.StepUpAuthModalPromise).toHaveBeenCalledTimes(2);
    expect(action.mock.calls.at(-1)?.[0].stepUpNonce).toBe('nonce-2');
  });

  it('should prompt again when the server no longer honours the grant', async () => {
    // e.g. another tab verified since, which replaces the grant on the shared session
    modalMock.StepUpAuthModalPromise.mockResolvedValueOnce(grantResult('nonce-1')).mockResolvedValueOnce(grantResult('nonce-2'));
    let acceptedNonce = 'nonce-1';
    const { result } = renderStepUpHook();
    const action = protectedAction(() => acceptedNonce);

    await act(() => result.current.runWithStepUp(action, PROMPT));
    acceptedNonce = 'nonce-2';
    await act(() => result.current.runWithStepUp(action, PROMPT));

    expect(modalMock.StepUpAuthModalPromise).toHaveBeenCalledTimes(2);
    expect(action.mock.calls.slice(2).map(([{ stepUpNonce }]) => stepUpNonce)).toEqual(['nonce-1', 'nonce-2']);
  });

  it('should report isPrompting only while the prompt is open', async () => {
    let resolvePrompt: (result: StepUpResult) => void = () => undefined;
    modalMock.StepUpAuthModalPromise.mockReturnValue(new Promise<StepUpResult>((resolve) => (resolvePrompt = resolve)));
    const { result } = renderStepUpHook();
    const action = protectedAction(() => 'nonce-1');

    let pending: Promise<string> = Promise.resolve('');
    await act(async () => {
      pending = result.current.runWithStepUp(action, PROMPT);
    });
    expect(result.current.isPrompting).toBe(true);

    await act(async () => {
      resolvePrompt(grantResult('nonce-1'));
      await pending;
    });
    expect(result.current.isPrompting).toBe(false);
  });
});
