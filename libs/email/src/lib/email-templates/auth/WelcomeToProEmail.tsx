import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailProLogo } from '../../components/EmailProLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

export const WelcomeToProEmail = () => (
  <Html>
    <Head />
    <Preview>Welcome to Jetstream Pro! 🚀</Preview>
    <Body style={EMAIL_STYLES.main}>
      <Container style={EMAIL_STYLES.container}>
        <EmailProLogo />
        <Heading style={EMAIL_STYLES.title}>You've unlocked the best of Jetstream by going Pro!</Heading>

        <Text style={SectionDetail}>
          Thank you <strong>so much</strong> for supporting Jetstream!
        </Text>

        <Hr style={horizontalRule} />

        <Section style={{ marginTop: 16, marginBottom: 16 }}>
          <Section>
            <Row>
              <Text style={mainHeading}>Browser Extension</Text>
              <Text style={SectionDetail}>
                Get the fastest access to Jetstream directly from Salesforce by installing the browser extension.
              </Text>
            </Row>
          </Section>
          <Section>
            <Row>
              <Text style={mainHeading}>Desktop Application</Text>
              <Text style={SectionDetail}>Our desktop application provides the most secure access of your Salesforce data.</Text>
            </Row>
          </Section>
          <Hr style={horizontalRule} />
          <Section>
            <Row>
              <Text style={mainHeading}>History Sync</Text>
              <Text style={SectionDetail}>
                Synchronize your Query History and Saved Load Mappings across all your devices and the browser extension!
              </Text>
              <Text style={SectionDetail}>
                <strong>Note:</strong> This setting is opt-in for the browser extension and desktop application. Enable it in the extension
                settings to share your data through the Jetstream server.
              </Text>
            </Row>
          </Section>
          <Hr style={horizontalRule} />
          <Section>
            <Row>
              <Text style={mainHeading}>Google Drive Integration</Text>
              <Text style={SectionDetail}>Connect your Google account to load and save files directly to Google Drive.</Text>
            </Row>
          </Section>
          <Hr style={horizontalRule} />
          <Section>
            <Text style={SectionDetailBold}>We value your feedback!</Text>
            <Text style={SectionDetail}>Don't hesitate to reach out with feature requests or questions.</Text>

            <ul style={{ paddingLeft: '15px', fontSize: '14px', listStyle: 'none' }}>
              <li>
                Send us an <Link href="mailto:support@getjetstream.app">email</Link>
              </li>
              <li>
                Join the conversation on <Link href="https://discord.gg/sfxd">Discord</Link>
              </li>
              <li>
                Request a feature on <Link href="https://github.com/jetstreamapp/jetstream">Github</Link>
              </li>
            </ul>
          </Section>
        </Section>
      </Container>
    </Body>
    <EmailFooter />
  </Html>
);

export default WelcomeToProEmail;

const mainHeading: React.CSSProperties = {
  margin: '0px',
  fontSize: 24,
  lineHeight: '32px',
  fontWeight: 600,
  color: '#111827',
};

const SectionDetail: React.CSSProperties = {
  margin: '0px',
  marginTop: 8,
  fontSize: 16,
  lineHeight: '24px',
  color: '#111827',
};

const SectionDetailBold: React.CSSProperties = {
  ...SectionDetail,
  fontWeight: 500,
};

const horizontalRule: React.CSSProperties = {
  marginLeft: '0px',
  marginRight: '0px',
  marginTop: 32,
  marginBottom: 32,
  width: '100%',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgb(209,213,219) !important',
};
