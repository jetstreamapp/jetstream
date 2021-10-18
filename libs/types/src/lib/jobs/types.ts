/**
 * Job types for jetstream-worker
 */

export type EmailType = 'WELCOME';

export interface EmailJob {
  userId: string;
  email: string;
  type: EmailType;
}
