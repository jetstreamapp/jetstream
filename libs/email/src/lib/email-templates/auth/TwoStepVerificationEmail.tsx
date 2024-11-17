import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

interface TwoStepVerificationEmailProps {
  baseUrl: string;
  validationCode: string;
  expMinutes: number;
}

export const TwoStepVerificationEmail = ({
  baseUrl = 'https://getjetstream.app',
  validationCode,
  expMinutes,
}: TwoStepVerificationEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your identity with Jetstream - {validationCode}</Preview>
    <Body style={EMAIL_STYLES.main}>
      <Container style={EMAIL_STYLES.container}>
        <EmailLogo />
        <Heading style={EMAIL_STYLES.codeTitle}>Verification code</Heading>

        <Text style={EMAIL_STYLES.codeDescription}>
          Enter this code in your open browser window. This code will expire in {expMinutes} minutes.
        </Text>

        <Section style={EMAIL_STYLES.codeContainer}>
          <Heading style={EMAIL_STYLES.codeStyle}>{validationCode}</Heading>
        </Section>

        <Section style={EMAIL_STYLES.buttonContainer}>
          <Link href={`${baseUrl}/auth/verify?type=2fa-email&code=${validationCode}`} style={EMAIL_STYLES.link}>
            Or click this link
          </Link>
        </Section>

        <Text style={EMAIL_STYLES.paragraphHeading}>Didn't request this?</Text>
        <Text style={EMAIL_STYLES.paragraph}>If you didn't make this request, you can safely ignore this email.</Text>
      </Container>
    </Body>
    <EmailFooter />
  </Html>
);

export default TwoStepVerificationEmail;

TwoStepVerificationEmail.PreviewProps = {
  validationCode: '123456',
  expMinutes: 10,
} as TwoStepVerificationEmailProps;
