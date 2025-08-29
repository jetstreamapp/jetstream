import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;
export interface AuthenticationChangeConfirmationEmailProps {
  preview: string;
  heading: string;
  additionalTextSegments?: string[];
}

export const AuthenticationChangeConfirmationEmail = ({
  preview,
  heading,
  additionalTextSegments,
}: AuthenticationChangeConfirmationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.codeTitle}>{heading}</Heading>

          {!!additionalTextSegments?.length && (
            <Section style={{ marginTop: 16, marginBottom: 16 }}>
              {additionalTextSegments.map((text, index) => (
                <Text key={index} style={sectionText}>
                  {text}
                </Text>
              ))}
            </Section>
          )}

          <Text style={EMAIL_STYLES.paragraphHeading}>Didn't request this?</Text>
          <Text style={EMAIL_STYLES.paragraph}>You should immediately reset your password or login and ensure your account is secure.</Text>
          <Text style={EMAIL_STYLES.paragraph}>
            Contact <a href="mailto:support@getjetstream.app">Jetstream Support</a> if you need further assistance.
          </Text>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default AuthenticationChangeConfirmationEmail;

const sectionText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '16px',
  color: '#111827',
  marginBottom: 16,
};
