import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Link, Section, Text } from 'react-email';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

interface EmailChangeRequestedEmailProps {
  baseUrl?: string;
  /** Shown in full - this mailbox belongs to the account holder, who needs it to recognize a hijack. */
  newEmail: string;
  cancelToken: string;
  expMinutes: number;
}

export const EmailChangeRequestedEmail = ({
  baseUrl = 'https://getjetstream.app',
  newEmail,
  cancelToken,
  expMinutes,
}: EmailChangeRequestedEmailProps) => {
  const url = `${baseUrl}/auth/email-change/cancel?code=${encodeURIComponent(cancelToken)}`;

  return (
    <Html>
      <Head />
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>A change to your email address was requested</Heading>

          <Text style={EMAIL_STYLES.codeDescription}>
            Someone asked to change the email address on your Jetstream account to <strong>{newEmail}</strong>. The change only takes effect
            once it is confirmed from that address, and this request expires in {expMinutes} minutes.
          </Text>

          <Text style={EMAIL_STYLES.paragraphHeading}>Didn't request this?</Text>
          <Text style={EMAIL_STYLES.paragraph}>
            Cancel the request below, then reset your password immediately - someone else may have access to your account.
          </Text>

          <Section style={EMAIL_STYLES.buttonContainer}>
            <Button href={url} style={EMAIL_STYLES.button}>
              Cancel this request
            </Button>
          </Section>

          <Text style={EMAIL_STYLES.codeDescription}>
            Use this link{' '}
            <Link href={url} style={EMAIL_STYLES.link}>
              {url}
            </Link>
            .
          </Text>

          <Text style={EMAIL_STYLES.paragraph}>
            Need help? Contact us at{' '}
            <Link href="mailto:support@getjetstream.app" style={EMAIL_STYLES.link}>
              support@getjetstream.app
            </Link>
            .
          </Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default EmailChangeRequestedEmail;

EmailChangeRequestedEmail.PreviewProps = {
  newEmail: 'new-address@example.com',
  cancelToken: 'b'.repeat(64),
  expMinutes: 60,
} as EmailChangeRequestedEmailProps;
