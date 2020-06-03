/* eslint-disable @typescript-eslint/no-explicit-any */
export class UserFacingError extends Error {
  additionalData?: any;
  constructor(message: string, additionalData?: any) {
    super(message);
    this.message = message;
    this.additionalData = additionalData;
  }
}
