import type { StepUpMethod } from '@jetstream/auth/types';
import { describe, expect, it, vi } from 'vitest';
import { actionDisplayName, methodDisplayName, type Action } from '../auth-logging.db.service';

vi.mock('@jetstream/api-config', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: { loginActivity: { create: vi.fn() } },
}));

/**
 * The session-activity UI renders the raw action string whenever the display map misses, so a new
 * Action added without a label leaks an enum value like EMAIL_CHANGE_COMPLETED into the user's
 * activity list. The Record<Action, string> type already enforces this at compile time; this asserts
 * it at runtime too, and pins the labels the UI is expected to show.
 */
describe('actionDisplayName', () => {
  it('should have a non-empty label for every action', () => {
    const entries = Object.entries(actionDisplayName) as [Action, string][];
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach(([action, label]) => {
      expect(label, `missing display name for ${action}`).toBeTruthy();
      // A label that is just the enum value means somebody forgot to write one.
      expect(label).not.toBe(action);
    });
  });

  it('should label the email-change and step-up actions', () => {
    expect(actionDisplayName.EMAIL_CHANGE_REQUEST).toBe('Email Change Requested');
    expect(actionDisplayName.EMAIL_CHANGE_COMPLETED).toBe('Email Change Completed');
    expect(actionDisplayName.EMAIL_CHANGE_CANCELLED).toBe('Email Change Cancelled');
    expect(actionDisplayName.EMAIL_CHANGE_FAILED).toBe('Email Change Failed');
    expect(actionDisplayName.STEP_UP_AUTH).toBe('Re-authentication');
  });
});

describe('methodDisplayName', () => {
  it('should label the methods the email-change flow records', () => {
    expect(methodDisplayName.USER_PROFILE).toBe('User Profile');
    expect(methodDisplayName.EMAIL_LINK).toBe('Email Link');
  });

  it('should label every step-up factor', () => {
    // Step-up logging records the uppercased StepUpMethod, so every member of that union needs an
    // entry or the raw value leaks into the session-activity UI.
    const stepUpMethods: StepUpMethod[] = ['password', '2fa-otp', 'email'];
    stepUpMethods.forEach((method) => {
      expect(methodDisplayName[method.toUpperCase()], `missing display name for step-up method ${method}`).toBeTruthy();
    });
  });
});
