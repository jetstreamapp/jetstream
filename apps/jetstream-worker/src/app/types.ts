import { EMAIL_JOB_TYPE } from './jobs/email.job';

export interface JobRequestTypes<P> {
  type: typeof EMAIL_JOB_TYPE;
  payload: P;
}

export interface JobRequestEmail extends JobRequestTypes<EmailJob> {
  type: 'EMAIL';
}

export type EmailType = 'WELCOME';

export interface EmailJob {
  type: EmailType;
  userId: string;
  email: string;
}
