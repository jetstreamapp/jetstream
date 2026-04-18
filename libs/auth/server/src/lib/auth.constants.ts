export const CURRENT_TOS_VERSION = '2026-03-19';

// Used as a stand-in user for pre-auth flows that should not reveal whether an account exists
// (e.g., registering with an already-in-use email). Never references a real User row, so any
// code writing rows that FK to User must treat this id as "no user" and store null instead.
export const PLACEHOLDER_USER_ID = '00000000-0000-0000-0000-000000000000';

export const PASSWORD_RESET_DURATION_MINUTES = 30;
export const TOKEN_DURATION_MINUTES = 15;
export const EMAIL_VERIFICATION_TOKEN_DURATION_HOURS = 1;

// Maximum failed OTP / reset-token submissions before we invalidate the attempt
// (destroy the session for /auth/verify, delete the reset row for /password/reset/verify).
export const MAX_VERIFICATION_ATTEMPTS = 5;

export const DELETE_AUTH_ACTIVITY_DAYS = 365;
export const DELETE_EMAIL_ACTIVITY_DAYS = 180;
export const DELETE_TOKEN_DAYS = 3;
export const DELETE_MAILGUN_WEBHOOK_DAYS = 30;
export const DELETE_EXPIRED_DOMAIN_VERIFICATION_DAYS = 1;
