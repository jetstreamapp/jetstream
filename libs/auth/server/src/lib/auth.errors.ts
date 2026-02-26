type ErrorType =
  | 'AccountLocked'
  | 'AuthError'
  | 'ExpiredVerificationToken'
  | 'IdentityLinkingNotAllowed'
  | 'InactiveUser'
  | 'InvalidAccessToken'
  | 'InvalidAction'
  | 'InvalidCaptcha'
  | 'InvalidCredentials'
  | 'InvalidCsrfToken'
  | 'InvalidOrExpiredResetToken'
  | 'InvalidParameters'
  | 'InvalidProvider'
  | 'InvalidRegistration'
  | 'InvalidSession'
  | 'InvalidVerificationToken'
  | 'InvalidVerificationType'
  | 'LoginWithExistingIdentity'
  | 'MissingEntitlement'
  | 'PasswordReused'
  | 'PasswordResetRequired'
  | 'ProviderNotAllowed'
  | 'ProviderEmailNotVerified'
  | 'SsoAutoProvisioningDisabled'
  | 'SsoInvalidAction'
  | 'SsoLicenseLimitExceeded';

type ErrorOptions = Error | Record<string, unknown>;

export class AuthError extends Error {
  type: ErrorType;
  kind?: 'signIn' | 'error';
  userId?: string;

  constructor(message?: string | Error, errorOptions?: ErrorOptions) {
    if (message instanceof Error) {
      super(undefined, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cause: { err: message, ...(message.cause as any), ...errorOptions },
      });
    } else if (typeof message === 'string') {
      if (errorOptions instanceof Error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        errorOptions = { err: errorOptions, ...(errorOptions.cause as any) };
      }
      super(message, errorOptions);
    } else {
      super(undefined, message);
    }
    this.name = this.constructor.name;

    // @ts-expect-error https://github.com/microsoft/TypeScript/issues/3841
    this.type = this.constructor.type ?? 'AuthError';

    // @ts-expect-error https://github.com/microsoft/TypeScript/issues/3841
    this.kind = this.constructor.kind ?? 'error';

    if (errorOptions && 'userId' in errorOptions && typeof errorOptions.userId === 'string') {
      this.userId = errorOptions.userId;
    }

    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class InvalidCsrfToken extends AuthError {
  static type: ErrorType = 'InvalidCsrfToken';
}

export class InvalidCredentials extends AuthError {
  static type: ErrorType = 'InvalidCredentials';
}

export class InvalidAction extends AuthError {
  static type: ErrorType = 'InvalidAction';
}

export class InvalidProvider extends AuthError {
  static type: ErrorType = 'InvalidProvider';
}

export class InvalidParameters extends AuthError {
  static type: ErrorType = 'InvalidParameters';
}

export class InvalidRegistration extends AuthError {
  static type: ErrorType = 'InvalidRegistration';
}

export class LoginWithExistingIdentity extends AuthError {
  static type: ErrorType = 'LoginWithExistingIdentity';
}

export class InvalidSession extends AuthError {
  static type: ErrorType = 'InvalidSession';
}

export class InvalidCaptcha extends AuthError {
  static type: ErrorType = 'InvalidCaptcha';
}

export class InvalidVerificationType extends AuthError {
  static type: ErrorType = 'InvalidVerificationType';
}

export class ExpiredVerificationToken extends AuthError {
  static type: ErrorType = 'ExpiredVerificationToken';
}

export class InvalidVerificationToken extends AuthError {
  static type: ErrorType = 'InvalidVerificationToken';
}

export class InvalidOrExpiredResetToken extends AuthError {
  static type: ErrorType = 'InvalidOrExpiredResetToken';
}

export class InactiveUser extends AuthError {
  static type: ErrorType = 'InactiveUser';
}

export class IdentityLinkingNotAllowed extends AuthError {
  static type: ErrorType = 'IdentityLinkingNotAllowed';
}

export class InvalidAccessToken extends AuthError {
  static type: ErrorType = 'InvalidAccessToken';
}

export class MissingEntitlement extends AuthError {
  static type: ErrorType = 'MissingEntitlement';
}

export class ProviderNotAllowed extends AuthError {
  static type: ErrorType = 'ProviderNotAllowed';
}

export class ProviderEmailNotVerified extends AuthError {
  static type: ErrorType = 'ProviderEmailNotVerified';
}

export class PasswordReused extends AuthError {
  static type: ErrorType = 'PasswordReused';
}

export class PasswordResetRequired extends AuthError {
  static type: ErrorType = 'PasswordResetRequired';
}

export class AccountLocked extends AuthError {
  static type: ErrorType = 'AccountLocked';
  lockedUntil?: Date;

  constructor(message?: string, lockedUntil?: Date) {
    super(message);
    this.lockedUntil = lockedUntil;
  }
}

export class SsoAutoProvisioningDisabled extends AuthError {
  static type: ErrorType = 'SsoAutoProvisioningDisabled';
}

export class SsoInvalidAction extends AuthError {
  static type: ErrorType = 'SsoInvalidAction';
}

export class SsoLicenseLimitExceeded extends AuthError {
  static type: ErrorType = 'SsoLicenseLimitExceeded';
}
