import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

export const PasswordResetConfirmationEmail = () => {
  return (
    <Html>
      <Head />
      <Preview>Your password has been reset</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>Your password has been successfully reset</Heading>

          <Text style={EMAIL_STYLES.paragraphHeading}>Didn't request this?</Text>
          <Text style={EMAIL_STYLES.paragraph}>
            You should immediately reset your password, contact <a href="mailto:support@getjetstream.app">Jetstream Support</a> if you need
            further assistance.
          </Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default PasswordResetConfirmationEmail;
