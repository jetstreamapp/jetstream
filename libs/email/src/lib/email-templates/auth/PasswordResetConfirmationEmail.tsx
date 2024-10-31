import { Body, Container, Head, Heading, Html, Img, Preview, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EMAIL_STYLES } from '../../shared-styles';

export const PasswordResetConfirmationEmail = () => {
  return (
    <Html>
      <Head />
      <Preview>Your password has been reset</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <Img
            src="https://res.cloudinary.com/getjetstream/image/upload/v1634516631/public/jetstream-logo-200w.png"
            width="200"
            alt="Jetstream"
            style={EMAIL_STYLES.logo}
          />
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
