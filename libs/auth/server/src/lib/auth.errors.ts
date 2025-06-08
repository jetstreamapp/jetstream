type ErrorType =
  | 'AuthError'
  | 'ExpiredVerificationToken'
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
  | 'MissingEntitlement';

type ErrorOptions = Error | Record<string, unknown>;

export class AuthError extends Error {
  type: ErrorType;
  kind?: 'signIn' | 'error';
  userId?: string;

  constructor(message?: string | Error, errorOptions?: ErrorOptions) {
    if (message instanceof Error) {
      super(undefined, {
        cause: { err: message, ...(message.cause as any), ...errorOptions },
      });
    } else if (typeof message === 'string') {
      if (errorOptions instanceof Error) {
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

export class InvalidAccessToken extends AuthError {
  static type: ErrorType = 'InvalidAccessToken';
}

export class MissingEntitlement extends AuthError {
  static type: ErrorType = 'MissingEntitlement';
}
