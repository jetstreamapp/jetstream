import { Body, Container, Head, Heading, Html, Img, Preview, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EMAIL_STYLES } from '../../shared-styles';

interface GenericEmailProps {
  preview: string;
  heading: string;
  segments: string[];
}

export const GenericEmail = ({ preview, heading, segments }: GenericEmailProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://res.cloudinary.com/getjetstream/image/upload/v1634516631/public/jetstream-logo-200w.png"
          width="200"
          alt="Jetstream"
          style={EMAIL_STYLES.logo}
        />
        <Heading style={title}>{heading}</Heading>

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

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji",Segoe UI Symbol',
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #ddd',
  borderRadius: '5px',
  marginTop: '20px',
  width: '710px',
  maxWidth: '100%',
  margin: '0 auto',
  padding: '5% 3%',
};

const title: React.CSSProperties = {
  textAlign: 'center' as const,
};

const sectionText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '16px',
  color: '#111827',
  marginBottom: 16,
};
