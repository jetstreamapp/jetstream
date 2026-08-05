import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Link, Section, Text } from 'react-email';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

interface EmailChangeVerifyEmailProps {
  baseUrl?: string;
  /** Masked on purpose - if the requester mistyped a stranger's address, that stranger must not learn the account holder's email. */
  currentEmailMasked: string;
  token: string;
  expMinutes: number;
}

export const EmailChangeVerifyEmail = ({
  baseUrl = 'https://getjetstream.app',
  currentEmailMasked,
  token,
  expMinutes,
}: EmailChangeVerifyEmailProps) => {
  // Lands on a page that only renders - confirming requires an explicit click there, so a mail
  // scanner following this link cannot complete the change.
  const url = `${baseUrl}/auth/email-change/confirm?code=${encodeURIComponent(token)}`;

  return (
    <Html>
      <Head />
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>Confirm your new email address</Heading>

          <Text style={EMAIL_STYLES.codeDescription}>
            Someone asked to use this address for the Jetstream account currently signed in as {currentEmailMasked}. Confirm below to make
            the change. This link will expire in {expMinutes} minutes.
          </Text>

          <Section style={EMAIL_STYLES.buttonContainer}>
            <Button href={url} style={EMAIL_STYLES.button}>
              Confirm your new email address
            </Button>
          </Section>

          <Text style={EMAIL_STYLES.paragraphHeading}>Having issues with the button above?</Text>

          <Text style={EMAIL_STYLES.codeDescription}>
            Use this link{' '}
            <Link href={url} style={EMAIL_STYLES.link}>
              {url}
            </Link>
            .
          </Text>

          <Text style={EMAIL_STYLES.paragraphHeading}>Didn't request this?</Text>
          <Text style={EMAIL_STYLES.paragraph}>
            If you didn't make this request, you can safely ignore this email and nothing will change.
          </Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default EmailChangeVerifyEmail;

EmailChangeVerifyEmail.PreviewProps = {
  currentEmailMasked: 't****@example.com',
  token: 'a'.repeat(64),
  expMinutes: 60,
} as EmailChangeVerifyEmailProps;
