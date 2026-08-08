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

// How long a minted-but-unconfirmed TOTP secret stays on the session. Long enough to install an
// authenticator app and scan the code, short enough that an abandoned enrollment does not leave a
// usable secret sitting on the session until it expires.
export const TOTP_ENROLLMENT_TTL_MINUTES = 15;

// How long a step-up grant remains usable. Kept short because the grant authorizes a sensitive
// action - it is also single-use, so this only bounds the window between verifying and acting.
export const STEP_UP_AUTH_TTL_MINUTES = 5;
// Cool-down after exhausting MAX_VERIFICATION_ATTEMPTS step-up submissions. Unlike /auth/verify we
// do NOT destroy the session here - the user is already authenticated and killing a working session
// over a few mistyped passwords is a self-inflicted denial of service.
export const STEP_UP_LOCKOUT_MINUTES = 15;

// Lifetime of the token emailed to the new address to prove mailbox ownership.
export const EMAIL_CHANGE_TOKEN_DURATION_MINUTES = 60;
// Minimum time between completed email changes for a single user.
export const EMAIL_CHANGE_MIN_INTERVAL_HOURS = 24;
// Blocks the compromised-mailbox -> password reset -> change email -> permanent takeover chain by
// forcing an attacker who reset the password to wait, giving the real owner time to notice.
export const PASSWORD_RESET_EMAIL_CHANGE_COOLDOWN_HOURS = 24;

export const DELETE_AUTH_ACTIVITY_DAYS = 365;
export const DELETE_EMAIL_ACTIVITY_DAYS = 180;
export const DELETE_TOKEN_DAYS = 3;
export const DELETE_MAILGUN_WEBHOOK_DAYS = 30;
export const DELETE_EXPIRED_DOMAIN_VERIFICATION_DAYS = 1;
