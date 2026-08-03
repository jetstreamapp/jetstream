import { ORG_INACTIVITY_EXPIRATION_DAYS, pluralizeFromNumber } from '@jetstream/shared/utils';
import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'react-email';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

interface OrgExpirationWarningEmailProps {
  orgs: Array<{ username: string; organizationId: string; instanceUrl: string; daysUntilExpiration: number }>;
  loginUrl: string;
}

export const OrgExpirationWarningEmail = ({ orgs, loginUrl }: OrgExpirationWarningEmailProps): React.ReactElement => {
  const hasExpired = orgs.some((org) => org.daysUntilExpiration <= 0);
  const hasExpiring = orgs.some((org) => org.daysUntilExpiration > 0);

  const preview = hasExpired ? 'Your Salesforce org connections have ended' : `Your Salesforce org connections are ending soon`;

  const heading = hasExpired && !hasExpiring ? 'Salesforce Org Connections Ended' : 'Salesforce Org Connections Ending Soon';

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={EMAIL_STYLES.main}>
        <Container style={EMAIL_STYLES.container}>
          <EmailLogo />
          <Heading style={EMAIL_STYLES.title}>{heading}</Heading>

          <Section style={{ marginTop: 16, marginBottom: 16 }}>
            <Text style={sectionText}>
              Salesforce ends a connection when an org has not been used for {ORG_INACTIVITY_EXPIRATION_DAYS} days. These orgs are at or
              past that limit:
            </Text>

            {orgs.map((org, index) => (
              <React.Fragment key={index}>
                <Text style={orgText}>
                  <strong>{org.username}</strong>
                  <br />
                  {org.organizationId}
                  <br />
                  {org.instanceUrl}
                  <br />
                  <span style={expirationText}>
                    {org.daysUntilExpiration <= 0
                      ? '⚠️ Connection ended'
                      : `Ends in ${org.daysUntilExpiration} ${pluralizeFromNumber('day', org.daysUntilExpiration)}`}
                  </span>
                </Text>
              </React.Fragment>
            ))}

            {hasExpiring && (
              <Text style={sectionText}>To keep these connections, open each org in Jetstream before the date shown above.</Text>
            )}

            {hasExpired && (
              <Text style={sectionText}>
                These connections have already ended. Log in to Jetstream and reconnect the org to keep using it.
              </Text>
            )}

            <Text style={sectionText}>
              This limit is set by Salesforce for connected apps — it is not a Jetstream policy. Any time you use an org in Jetstream, its{' '}
              {ORG_INACTIVITY_EXPIRATION_DAYS}-day clock resets.
            </Text>
          </Section>

          <Button style={EMAIL_STYLES.button} href={`${loginUrl}/org-groups`}>
            Go to Jetstream
          </Button>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default OrgExpirationWarningEmail;

OrgExpirationWarningEmail.PreviewProps = {
  orgs: [
    {
      username: 'admin@acme.com',
      organizationId: '00D000000000000EAA',
      instanceUrl: 'https://acme.my.salesforce.com',
      daysUntilExpiration: 7,
    },
    {
      username: 'dev@acme.com.dev',
      organizationId: '00D000000000001EAA',
      instanceUrl: 'https://acme--dev.sandbox.my.salesforce.com',
      daysUntilExpiration: 1,
    },
    {
      username: 'old@acme.com',
      organizationId: '00D000000000002EAA',
      instanceUrl: 'https://acme--old.sandbox.my.salesforce.com',
      daysUntilExpiration: 0,
    },
  ],
  loginUrl: 'https://getjetstream.app/app',
} as OrgExpirationWarningEmailProps;

const sectionText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '16px',
  color: '#111827',
  marginBottom: 16,
};

const orgText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '20px',
  color: '#374151',
  marginBottom: 12,
  marginLeft: 16,
  textAlign: 'left',
};

const expirationText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#dc2626',
};
