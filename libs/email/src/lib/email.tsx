import { ENV, logger, sendEmail } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { render } from '@react-email/render';
import React, { JSX } from 'react';
import {
  AuthenticationChangeConfirmationEmail,
  AuthenticationChangeConfirmationEmailProps,
} from './email-templates/auth/AuthenticationChangeConfirmationEmail';
import { GenericEmail } from './email-templates/auth/GenericEmail';
import { PasswordResetConfirmationEmail } from './email-templates/auth/PasswordResetConfirmationEmail';
import { PasswordResetEmail } from './email-templates/auth/PasswordResetEmail';
import { TwoStepVerificationEmail } from './email-templates/auth/TwoStepVerificationEmail';
import { VerifyEmail } from './email-templates/auth/VerifyEmail';
import { WelcomeEmail } from './email-templates/auth/WelcomeEmail';
import { WelcomeToProEmail } from './email-templates/auth/WelcomeToProEmail';
/**
 *
 * TODO:
 * Is there any benefit of sending these via mailgun instead of just SMTP directly?
 */

function renderComponent(component: JSX.Element) {
  return Promise.all([render(component, { plainText: false }), render(component, { plainText: true })]);
}

export async function sendUserFeedbackEmail(
  emailAddress: string,
  userId: string,
  content: string,
  attachment?: { data: Buffer; filename: string }[],
) {
  try {
    const component = <GenericEmail heading="User submitted feedback" preview="User submitted feedback" segments={[userId, content]} />;
    const [html, text] = await renderComponent(component);

    await sendEmail({
      to: emailAddress,
      subject: 'User submitted feedback',
      text,
      html,
      attachment,
    });
  } catch (error) {
    logger.error({ ...getErrorMessageAndStackObj(error) }, 'Error sending user feedback email');
  }
}

export async function sendWelcomeEmail(emailAddress: string) {
  try {
    const component = <WelcomeEmail />;
    const [html, text] = await renderComponent(component);

    await sendEmail({
      to: emailAddress,
      subject: 'Welcome to Jetstream',
      text,
      html,
    });
  } catch (error) {
    logger.error({ ...getErrorMessageAndStackObj(error) }, 'Error sending welcome email');
  }
}

export async function sendWelcomeToProEmail(emailAddress: string) {
  try {
    const component = <WelcomeToProEmail />;
    const [html, text] = await renderComponent(component);

    await sendEmail({
      to: emailAddress,
      subject: 'Welcome to Jetstream Pro!',
      text,
      html,
    });
  } catch (error) {
    logger.error({ ...getErrorMessageAndStackObj(error) }, 'Error sending welcome to pro email');
  }
}

export async function sendGoodbyeEmail(emailAddress: string, billingPortalLinkText?: Maybe<string>) {
  const component = (
    <GenericEmail
      heading="We're sorry to see you go!"
      preview="We're sorry to see you go!"
      segments={[
        `We hope that you will give us a try in the future.`,
        `If you have any feedback on how we can improve or why Jetstream wasn't the right tool for you, please let us know by replying to this email.`,
        billingPortalLinkText || '',
      ]}
    />
  );
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: emailAddress,
    subject: `We're sorry to see you go!`,
    text,
    html,
  });
}

export async function sendInternalAccountDeletionEmail(userId: string, reason?: Maybe<string>, billingResults?: Maybe<string>) {
  const component = (
    <GenericEmail
      heading="Account deleted"
      preview="Account deleted"
      segments={[
        `The user ${userId} was deleted.`,
        reason || 'No reason was provided.',
        billingResults || 'No billing results were provided.',
      ]}
    />
  );
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: ENV.JETSTREAM_EMAIL_REPLY_TO,
    subject: `Jetstream account deleted`,
    text,
    html,
  });
}

export async function sendEmailVerification(emailAddress: string, code: string, expHours: number) {
  const component = <VerifyEmail baseUrl={ENV.JETSTREAM_SERVER_URL} expHours={expHours} validationCode={code} />;
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: emailAddress,
    subject: `Verify your email on Jetstream - ${code}`,
    text,
    html,
  });
}

export async function sendVerificationCode(emailAddress: string, code: string, expMinutes: number) {
  const component = <TwoStepVerificationEmail baseUrl={ENV.JETSTREAM_SERVER_URL} expMinutes={expMinutes} validationCode={code} />;
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: emailAddress,
    subject: `Verify your identity on Jetstream - ${code}`,
    text,
    html,
  });
}

export async function sendPasswordReset(emailAddress: string, code: string, expMinutes: number) {
  const component = (
    <PasswordResetEmail baseUrl={ENV.JETSTREAM_SERVER_URL} expMinutes={expMinutes} validationCode={code} emailAddress={emailAddress} />
  );
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: emailAddress,
    subject: 'Reset your password on Jetstream',
    text,
    html,
  });
}

export async function sendPasswordResetConfirmation(emailAddress: string) {
  const component = <PasswordResetConfirmationEmail />;
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: emailAddress,
    subject: 'Jetstream password reset confirmation',
    text,
    html,
  });
}

export async function sendAuthenticationChangeConfirmation(
  emailAddress: string,
  subject: string,
  props: AuthenticationChangeConfirmationEmailProps,
) {
  const component = <AuthenticationChangeConfirmationEmail {...props} />;
  const [html, text] = await renderComponent(component);

  await sendEmail({
    to: emailAddress,
    subject,
    text,
    html,
  });
}
