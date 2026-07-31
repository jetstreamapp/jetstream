import { pluralizeFromNumber } from '@jetstream/shared/utils';
import * as React from 'react';
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'react-email';
import { EmailFooter } from '../../components/EmailFooter';
import { EmailLogo } from '../../components/EmailLogo';
import { EMAIL_STYLES } from '../../shared-styles';

void React.createElement;

export interface SsoCertificateExpirationEmailProps {
  teamName: string;
  idpEntityId: string;
  expiresAt: Date;
  /** Negative once the certificate has already expired; 0 is the expiration date itself */
  daysUntilExpiration: number;
  ssoSettingsUrl: string;
}

function formatExpirationDate(expiresAt: Date) {
  return expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/**
 * 0 is the final scheduled reminder, sent on the expiration date while the certificate is still
 * valid for the rest of that day — only a negative value means it has actually expired.
 */
function describeExpiration(daysUntilExpiration: number) {
  if (daysUntilExpiration < 0) {
    return 'has expired';
  }
  if (daysUntilExpiration === 0) {
    return 'expires today';
  }
  return `expires in ${daysUntilExpiration} ${pluralizeFromNumber('day', daysUntilExpiration)}`;
}

function expirationBadgeLabel(daysUntilExpiration: number) {
  if (daysUntilExpiration < 0) {
    return '⚠️ Expired';
  }
  if (daysUntilExpiration === 0) {
    return 'Expires today';
  }
  return `Expires in ${daysUntilExpiration} ${pluralizeFromNumber('day', daysUntilExpiration)}`;
}

export const SsoCertificateExpirationEmail = ({
  teamName,
  idpEntityId,
  expiresAt,
  daysUntilExpiration,
  ssoSettingsUrl,
}: SsoCertificateExpirationEmailProps): React.ReactElement => {
  const hasExpired = daysUntilExpiration < 0;
  const heading = hasExpired ? 'SSO Certificate Expired' : 'SSO Certificate Expiring Soon';
  const preview = `The SAML signing certificate for ${teamName} ${describeExpiration(daysUntilExpiration)}`;

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
              The SAML signing certificate configured for single sign-on on the <strong>{teamName}</strong> team{' '}
              {hasExpired ? 'expired on' : 'expires on'} <strong>{formatExpirationDate(expiresAt)}</strong>.
            </Text>

            <Text style={detailText}>
              Identity Provider: {idpEntityId}
              <br />
              <span style={hasExpired ? expiredText : expirationText}>{expirationBadgeLabel(daysUntilExpiration)}</span>
            </Text>

            <Text style={sectionText}>
              Your identity provider will replace this certificate when it expires. Once it does, the certificate stored in Jetstream no
              longer matches and <strong>every SSO login for your team will fail</strong> until it is updated.
            </Text>

            <Text style={sectionText}>
              To update it, download the current metadata from your identity provider and upload it in Jetstream under Team Settings →
              Single Sign-On. If your identity provider publishes a metadata URL, you can paste that instead.
            </Text>

            {hasExpired && (
              <Text style={sectionText}>
                If your team can no longer sign in, an administrator with a non-SSO login method can still access Jetstream to update the
                configuration.
              </Text>
            )}
          </Section>

          <Button style={EMAIL_STYLES.button} href={ssoSettingsUrl}>
            Update SSO Configuration
          </Button>
        </Container>
      </Body>
      <EmailFooter />
    </Html>
  );
};

export default SsoCertificateExpirationEmail;

SsoCertificateExpirationEmail.PreviewProps = {
  teamName: 'Acme Corp',
  idpEntityId: 'http://www.okta.com/exk1a2b3c4d5e6f7g8h9',
  expiresAt: new Date('2026-09-15T00:00:00.000Z'),
  daysUntilExpiration: 14,
  ssoSettingsUrl: 'https://getjetstream.app/app/teams',
} as SsoCertificateExpirationEmailProps;

const sectionText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 500,
  lineHeight: '20px',
  color: '#111827',
  marginBottom: 16,
};

const detailText: React.CSSProperties = {
  margin: '0px',
  fontSize: 14,
  fontWeight: 400,
  lineHeight: '20px',
  color: '#374151',
  marginBottom: 16,
  marginLeft: 16,
  textAlign: 'left',
};

const expirationText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#b45309',
};

const expiredText: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#dc2626',
};
