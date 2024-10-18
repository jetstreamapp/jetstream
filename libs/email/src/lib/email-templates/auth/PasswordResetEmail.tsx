import { Body, Button, Container, Head, Heading, Html, Img, Link, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EMAIL_STYLES } from '../../shared-styles';

interface PasswordResetEmailProps {
  baseUrl?: string;
  emailAddress: string;
  validationCode: string;
  expMinutes: number;
}

export const PasswordResetEmail = ({
  baseUrl = 'https://getjetstream.app',
  emailAddress,
  validationCode,
  expMinutes,
}: PasswordResetEmailProps) => {
  const url = `${baseUrl}/auth/password-reset/verify?email=${emailAddress}&code=${validationCode}`;

  return (
    <Html>
      <Head />
      <Preview>Reset your password with Jetstream</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <Img
            src="https://res.cloudinary.com/getjetstream/image/upload/v1634516631/public/jetstream-logo-200w.png"
            width="200"
            alt="Jetstream"
            style={EMAIL_STYLES.logo}
          />
          <Heading style={EMAIL_STYLES.codeTitle}>Reset your password</Heading>

          <Text style={EMAIL_STYLES.codeDescription}>
            Follow the link below to finish resetting your password. This link will expire in {expMinutes} minutes.
          </Text>

          <Section style={EMAIL_STYLES.buttonContainer}>
            <Button href={url} style={EMAIL_STYLES.button}>
              Finish resetting your password
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
          <Text style={EMAIL_STYLES.paragraph}>If you didn't make this request, you can safely ignore this email.</Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default PasswordResetEmail;

PasswordResetEmail.PreviewProps = {
  validationCode: '123456',
  emailAddress: 'test-long-name@some-long-email-address.com',
  expMinutes: 10,
} as PasswordResetEmailProps;
