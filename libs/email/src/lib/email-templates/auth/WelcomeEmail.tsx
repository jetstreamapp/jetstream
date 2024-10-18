import { Body, Column, Container, Head, Heading, Hr, Html, Img, Link, Preview, Row, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailFooter } from '../../components/EmailFooter';
import { EMAIL_STYLES } from '../../shared-styles';

export const WelcomeEmail = () => (
  <Html>
    <Head />
    <Preview>Welcome to Jetstream 🚀</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://res.cloudinary.com/getjetstream/image/upload/v1634516631/public/jetstream-logo-200w.png"
          width="200"
          alt="Jetstream"
          style={EMAIL_STYLES.logo}
        />
        <Heading style={title}>We’re excited to welcome you to Jetstream!</Heading>

        <Text style={description}>We’d love to hear from you! Share your thoughts on Jetstream.</Text>

        <ul style={{ paddingLeft: '15px', fontSize: '14px' }}>
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

        <Hr style={horizontalRule} />

        <Section style={{ marginTop: 16, marginBottom: 16 }}>
          <Section>
            <Row>
              <Text style={mainHeading}>Amazing Features</Text>
              <Text style={SectionDetail}>
                Jetstream offers an advanced suite of tools which make working on Salesforce more productive and enjoyable.
              </Text>
            </Row>
          </Section>
          <Section>
            <Hr style={horizontalRule} />

            {getFeatures().map((feature, index) => (
              <React.Fragment key={index}>
                <Section>
                  <Row>
                    <Column style={{ verticalAlign: 'baseline' }}>
                      <Img alt="heart icon" height="48" src={feature.image} width="48" style={image} />
                    </Column>
                    <Column style={{ width: '85%' }}>
                      <Text style={sectionHeading}>{feature.title}</Text>
                      {feature.content.map((content, index) => (
                        <Text key={index} style={index === 0 ? SectionDetailBold : SectionDetail}>
                          {content}
                        </Text>
                      ))}
                    </Column>
                  </Row>
                </Section>
                <Hr style={horizontalRule} />
              </React.Fragment>
            ))}
          </Section>
        </Section>
      </Container>
    </Body>
    <EmailFooter />
  </Html>
);

export default WelcomeEmail;

function getFeatures() {
  return [
    {
      image: 'https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_40/v1634490318/public/email/query.png',
      title: 'Query Records',
      content: [
        'Jetstream simplifies exploring records in your org.',
        <>
          Use <span style={textHighlight}>the most advanced query builder</span> to easily explore your data model and quickly find the
          records you are looking for.
        </>,
      ],
    },
    {
      image: 'https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_40/v1634490318/public/email/load.png',
      title: 'Load Records',
      content: [
        'Easily update your record data with Jetstream.',
        <>
          Jetstream’s data loader is <span style={textHighlight}>simple, powerful, and has no usage limits</span>.
        </>,
        <>
          You can also <span style={textHighlight}>load related data across multiple objects simultaneously</span>. Say goodbye to using
          complicated VLOOKUPS in Excel to load related data into Salesforce.
        </>,
      ],
    },
    {
      image: 'https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_40/v1634490318/public/email/automation.png',
      title: 'Automation Control',
      content: [
        `Easily review and toggle automation in your org.`,
        <>
          Use Jetstream's Automation Control to <span style={textHighlight}>view and toggle automation</span> in your org. Use this if you
          need to temporarily disable automation prior to a data load.
        </>,
      ],
    },
    {
      image: 'https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_40/v1634490318/public/email/permissions.png',
      title: 'Permission Manager',
      content: [
        'Updating field and object permissions has never been easier.',
        <>
          Easily <span style={textHighlight}>view and toggle field and object permissions across many objects</span> for multiple profiles
          and permission sets at once.
        </>,
      ],
    },
    {
      image: 'https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_40/v1634490318/public/email/deploy.png',
      title: 'Metadata Tools',
      content: [
        'Jetstream offers a versatile set of metadata tools.',
        <>
          <span style={textHighlight}>Deploy metadata</span> between orgs.
        </>,
        <>
          <span style={textHighlight}>Compare metadata</span> between orgs.
        </>,
        <>
          <span style={textHighlight}>Add metadata</span> to an outbound changeset.
        </>,
        <>
          <span style={textHighlight}>Download metadata</span> locally as a backup or make changes and re-deploy.
        </>,
      ],
    },
    {
      image: 'https://res.cloudinary.com/getjetstream/image/upload/c_scale,w_40/v1634490318/public/email/developer.png',
      title: 'Developer Tools',
      content: [
        'Replace the Developer Console with Jetstream.',
        <>
          Easily execute <span style={textHighlight}>anonymous Apex</span>.
        </>,
        <>
          View <span style={textHighlight}>debug logs</span> from your org.
        </>,
        <>
          Submit API requests using the <span style={textHighlight}>Salesforce API</span>.
        </>,
        <>
          Subscribe to and publish <span style={textHighlight}>Platform Events</span>.
        </>,
      ],
    },
  ];
}

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

const description: React.CSSProperties = {
  textAlign: 'left' as const,
  fontSize: 16,
};

const mainHeading: React.CSSProperties = {
  margin: '0px',
  fontSize: 24,
  lineHeight: '32px',
  fontWeight: 600,
  color: '#111827',
};

const sectionHeading: React.CSSProperties = {
  margin: '0px',
  fontSize: 20,
  fontWeight: 600,
  lineHeight: '28px',
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

const textHighlight: React.CSSProperties = {
  color: '#0176d3',
};

const image: React.CSSProperties = {
  maxWidth: '100%',
  verticalAlign: 'middle',
  lineHeight: '100%',
  border: '0',
  borderRadius: '4px',
  backgroundColor: '#0176d3',
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
