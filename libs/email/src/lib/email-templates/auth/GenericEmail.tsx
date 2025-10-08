import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

interface GenericEmailProps {
  preview: string;
  heading: string;
  segments: string[];
}

export const GenericEmail = ({ preview, heading, segments }: GenericEmailProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={EMAIL_STYLES.main}>
      <Container style={EMAIL_STYLES.container}>
        <EmailLogo />
        <Heading style={EMAIL_STYLES.title}>{heading}</Heading>

        <Section style={{ marginTop: 16, marginBottom: 16 }}>
          {segments.map((text, index) => (
            <Text key={index} style={sectionText}>
              {text}
            </Text>
          ))}
        </Section>
      </Container>
    </Body>
    <EmailFooter />
  </Html>
);

export default GenericEmail;

GenericEmail.PreviewProps = {
  preview: 'Test preview',
  heading: 'Some fancy heading',
  segments: ['can you do xyz?', 'yes, we can do xyz!'],
} as GenericEmailProps;

const sectionText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '16px',
  color: '#111827',
  marginBottom: 16,
};
