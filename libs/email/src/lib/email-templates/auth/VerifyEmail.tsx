import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EMAIL_STYLES } from '../../shared-styles';

interface VerifyEmailProps {
  baseUrl?: string;
  validationCode: string;
  expMinutes: number;
}

export const VerifyEmail = ({ baseUrl = 'https://getjetstream.app', validationCode, expMinutes }: VerifyEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your email address with Jetstream - {validationCode}</Preview>
    <Body style={EMAIL_STYLES.main}>
      <Container style={EMAIL_STYLES.container}>
        <Img
          src="https://res.cloudinary.com/getjetstream/image/upload/v1634516631/public/jetstream-logo-200w.png"
          width="200"
          alt="Jetstream"
          style={EMAIL_STYLES.logo}
        />
        <Heading style={EMAIL_STYLES.codeTitle}>Verify your email address</Heading>

        <Text style={EMAIL_STYLES.codeDescription}>
          Enter this code in your open browser window or press the button below. This code will expire in {expMinutes} minutes.
        </Text>

        <Section style={EMAIL_STYLES.codeContainer}>
          <Heading style={EMAIL_STYLES.codeStyle}>{validationCode}</Heading>
        </Section>

        <Section style={EMAIL_STYLES.buttonContainer}>
          <Button href={`${baseUrl}/auth/verify?type=email&code=${validationCode}`} style={EMAIL_STYLES.button}>
            Verify your email
          </Button>
        </Section>

        <Text style={EMAIL_STYLES.paragraphHeading}>Didn't request this?</Text>
        <Text style={EMAIL_STYLES.paragraph}>If you didn't make this request, you can safely ignore this email.</Text>
      </Container>
    </Body>
    <EmailFooter />
  </Html>
);

export default VerifyEmail;

VerifyEmail.PreviewProps = {
  validationCode: '123456',
  expMinutes: 10,
} as VerifyEmailProps;
