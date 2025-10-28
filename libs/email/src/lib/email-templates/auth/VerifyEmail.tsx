import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

interface VerifyEmailProps {
  baseUrl: string;
  validationCode: string;
  expHours: number;
}

export const VerifyEmail = ({ baseUrl = 'https://getjetstream.app', validationCode, expHours }: VerifyEmailProps) => (
  <Html>
    <Head />
    <Preview>Verify your email address with Jetstream - {validationCode}</Preview>
    <Body style={EMAIL_STYLES.main}>
      <Container style={EMAIL_STYLES.container}>
        <EmailLogo />
        <Heading style={EMAIL_STYLES.codeTitle}>Verify your email address</Heading>

        <Text style={EMAIL_STYLES.codeDescription}>
          Enter this code in your open browser window or press the button below. This code will expire in {expHours}{' '}
          {pluralizeFromNumber('hour', expHours)}.
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
  expHours: 48,
} as VerifyEmailProps;
