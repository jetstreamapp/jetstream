import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Link, Section, Text } from 'react-email';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

interface ExistingAccountSignupEmailProps {
  baseUrl?: string;
  emailAddress: string;
}

/**
 * Sent in place of a verification code when someone signs up with an address that already has an account.
 * The sign up screen looks the same either way, so only the owner of the inbox learns the account exists.
 */
export const ExistingAccountSignupEmail = ({ baseUrl = 'https://getjetstream.app', emailAddress }: ExistingAccountSignupEmailProps) => {
  const loginUrl = `${baseUrl}/auth/login/?email=${encodeURIComponent(emailAddress)}`;
  const resetPasswordUrl = `${baseUrl}/auth/password-reset/?email=${encodeURIComponent(emailAddress)}`;

  return (
    <Html>
      <Head />
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>You already have a Jetstream account</Heading>

          <Text style={EMAIL_STYLES.codeDescription}>
            Someone tried to sign up for Jetstream with this email address, but it already belongs to an account. If that was you, log in
            with the same method you used before - Google, Salesforce, single sign-on, or your email address and password.
          </Text>

          <Section style={EMAIL_STYLES.buttonContainer}>
            <Button href={loginUrl} style={EMAIL_STYLES.button}>
              Log in to Jetstream
            </Button>
          </Section>

          <Text style={EMAIL_STYLES.codeDescription}>
            Forgot your password?{' '}
            <Link href={resetPasswordUrl} style={EMAIL_STYLES.link}>
              Reset it
            </Link>
            .
          </Text>

          <Text style={EMAIL_STYLES.paragraphHeading}>Didn't try to sign up?</Text>
          <Text style={EMAIL_STYLES.paragraph}>You can safely ignore this email, nothing about your account has changed.</Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default ExistingAccountSignupEmail;

ExistingAccountSignupEmail.PreviewProps = {
  emailAddress: 'test-long-name@some-long-email-address.com',
} as ExistingAccountSignupEmailProps;
