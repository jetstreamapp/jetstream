/* eslint-disable @typescript-eslint/no-explicit-any */
export class UserFacingError extends Error {
  additionalData?: any;
  constructor(message: string, additionalData?: any) {
    super(message);
    this.message = message;
    this.additionalData = additionalData;
  }
}

export class AuthenticationError extends Error {
  additionalData?: any;
  constructor(message: string, additionalData?: any) {
    super(message);
    this.message = message;
    this.additionalData = additionalData;
  }
}

export class NotFoundError extends Error {
  additionalData?: any;
  constructor(message: string, additionalData?: any) {
    super(message);
    this.message = message;
    this.additionalData = additionalData;
  }
}
