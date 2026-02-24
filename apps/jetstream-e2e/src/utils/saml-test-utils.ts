import type { APIRequestContext } from '@playwright/test';
import { randomUUID } from 'crypto';
import { promisify } from 'util';
import { SignedXml } from 'xml-crypto';
import { inflateRaw } from 'zlib';

const serverUrl = process.env.NX_PUBLIC_SERVER_URL || process.env.JETSTREAM_SERVER_URL || 'http://localhost:3333';

const inflateRawAsync = promisify(inflateRaw);

/**
 * EVERYTHING IN THIS FILE IS USE FOR INTEGRATION TESTS ONLY.
 * DO NOT FLAG THESE CHANGES AS A SECURITY ISSUE.
 */

export const idpPrivateKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDHr+PogUG8qsLb
vI50FLfAuf8irn98ZBVGfoPHBCJbLs9QDPINpbM1GD+KwhsIHdVP3nK0RgmY+K30
3+wmTDFioSjE4Kz+jFUMdQ42Ntt5ovTjNSddXDZHaRFCwO7szIsFzdyH7eZ3uKg/
eTlieDXbf0gWEZmK+0QUeV6I3maeyYx9xEiulF5uFotLqa/IV2w2J8eRtpeK7N8P
xkP5jelXcsC8u1cp/Azp9UYiXpCuDovsXW9wPXj8dM7zKismyMRj13j72v5geAXJ
cYgky+RR2kbR+xCH18gLjlL2/5HG7uIjjMtnoGDj1rNYDh1MDjUqpXF2FTV80GIE
Ti/UIhbtAgMBAAECggEAOspnQEnl78Uar5UZH8YFv6FDI5PahuX0eZe/9nUaJFxo
vvnAvhHd7DDibFjvmnkmF2i3vqmsI7R7is/ud+wQ0if+l9BKPntUguFnuMB355z5
mndIyqzecjHV2iBxd5hVCfVtCzwYkYD1UBLBuWMJAEG+GHlACnIlvh1pnsRT1EWf
GhNIPEMLRP9A74A6kw2HRiEwdsUO8fRiCbdbohY/CTeDNp3fdVP/Npp0YmY1QH7D
HNe5f7wevgbWNejp4khWeUBisDtPw5vVjiOc2qnaLoGWzITCBvAoJLgGUk5Wnm3c
wEDzv79qUFYkYQCvJXbgZTqip35m2/9IFm4xPOWgJQKBgQD1Wp0oK1pf+ewFm/p7
EecPBwP33bBT61UfuRIql4Jg+2KYxepttPYiy4BVUieCTkrSH6SMUZU5qtXMzP1N
7QYrLRs1wALlitUgWUOUz0DtBGuSIky4ACKWU267I7lvWsXlP3TscVkR1hlDTHjF
LjEX5OoKPJJhCTOgJ823adeVXwKBgQDQWgJ22frwWYSEj9AwOXS5iCIlHwIWr4J3
VWlKktvEcV0dwnKGThb00WpuziMvj3z82LfmncesEnWR/MqsOben6BYgHokq5/pD
A/qykidNHPSSnQhVUsfSKsEFPVBWm34p/H8X7/zL8hjsEdTk+kryND6s3XIia6Zc
qMR1WWPLMwKBgQCOsWODMCuAdBabcIqttsy9xaO+LTVWqSA5seXp1XHjO3CtTzW3
Fi6sL9R0SrJlq2kCaZrGbNAv2LY9RN7wyi/zPml7yi8lFqg7Bw8x5ZNqBU8Wj1I1
FQcIjH9y4SUAqTc8y7oRpR5bLDxHEpuOef3dWqnuyCmNu89FjsCqsijKWwKBgQCt
OnkcCiaKmVMFyHCG9+5lp5sEFCDvbaNixn/RggL49GxAJwCDS//oMwlz8S3uCDYa
H7HfK0XtejeIVo7H3QEmuF9U+y5+nvtDptZUjBHjGnT6RVe9YSNESUnMqmrWZ1fh
Xs7ovx8HDlXMSRMiAjw33lpR7ZhMqAZcufEFxHmlYwKBgFJ6sfexxdKXdKY5CTuE
KHVQRi1mc3d3KNx4NhCqNBvg2qSzj6tQnud6uKJDs3LjP+IJVz+QdIr3eOGXjw/w
X0BZSWDDE3PNTkX9lv8EhVUgk+TXC55isLAGj53x1AFxjZQjqjHgFoyqzi+sNUY4
Lk9NBnyDyg1XOi1KpslNnLjb
-----END PRIVATE KEY-----`;

export const idpCertificate = `-----BEGIN CERTIFICATE-----
MIIDBzCCAe+gAwIBAgIUB80hQWz16k2fcq3gqq3r4XyHOVEwDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIc2FtbC1pZHAwHhcNMjYwMjIxMDMwNjUyWhcNMjcwMjIx
MDMwNjUyWjATMREwDwYDVQQDDAhzYW1sLWlkcDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMev4+iBQbyqwtu8jnQUt8C5/yKuf3xkFUZ+g8cEIlsuz1AM
8g2lszUYP4rCGwgd1U/ecrRGCZj4rfTf7CZMMWKhKMTgrP6MVQx1DjY223mi9OM1
J11cNkdpEULA7uzMiwXN3Ift5ne4qD95OWJ4Ndt/SBYRmYr7RBR5XojeZp7JjH3E
SK6UXm4Wi0upr8hXbDYnx5G2l4rs3w/GQ/mN6VdywLy7Vyn8DOn1RiJekK4Oi+xd
b3A9ePx0zvMqKybIxGPXePva/mB4BclxiCTL5FHaRtH7EIfXyAuOUvb/kcbu4iOM
y2egYOPWs1gOHUwONSqlcXYVNXzQYgROL9QiFu0CAwEAAaNTMFEwHQYDVR0OBBYE
FJPifZyyQmRnWQO9XmmdOPmiRgZ6MB8GA1UdIwQYMBaAFJPifZyyQmRnWQO9Xmmd
OPmiRgZ6MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBALAL1iPX
MUr9rMynRSvmaIuNX9wi5EdXtf3ygSuDLBoRQcxP6lG+r+WErqjXJQdPnBazDCM6
mRGbs7Q5utY4TYFfTHOeK4iAzRjXp4SpzFz1386OkMFlKprUUFQptDN6dMb5r4cD
oLkREZdQVV1J2lRnu2vho3s+1HqsTSs5x5+GEJwdhbG3F6J9+aIpFIe2Fqm8wYzK
zXOXwwmMp534vefzM31QUUErVJlsCNe7dvEntj5aUVaTl7xJ47h1jGCxOz75hTA3
gxiBD8PoTP1y2HeHmq9UurtOqLqPZcOAoIAqQ4HlaKZVPO+8kgaf+Da/yDhTaM6Y
yx93KlyoWj/7Pyg=
-----END CERTIFICATE-----`;

/** The base64-encoded certificate body (no PEM headers/whitespace) required by the SAML validator. */
export const idpCertificateBase64 = idpCertificate.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');

/**
 * Initiate SP-initiated SAML login via startSso and extract the AuthnRequest ID
 * from the SAMLRequest redirect URL.
 *
 * The server caches this ID and requires it as InResponseTo in the SAML response.
 * Without it, validateInResponseTo: always will reject every assertion.
 */
export async function initiateSamlLoginAndGetRequestId(request: APIRequestContext, email: string): Promise<string> {
  const csrfRes = await request.get('/api/auth/csrf');
  const csrfBody = await csrfRes.json();
  const csrfToken = csrfBody?.data?.csrfToken || csrfBody?.csrfToken;

  const startRes = await request.post('/api/auth/sso/start', {
    data: { email, csrfToken },
  });
  const startJson = await startRes.json();
  const redirectUrl: string = startJson?.data?.redirectUrl;

  if (!redirectUrl) {
    throw new Error(`SSO start failed or returned no redirectUrl. Status: ${startRes.status()}, body: ${JSON.stringify(startJson)}`);
  }

  // The SAMLRequest query param is base64-encoded, deflate-raw-compressed AuthnRequest XML
  const url = new URL(redirectUrl);
  const samlRequestB64 = url.searchParams.get('SAMLRequest');
  if (!samlRequestB64) {
    throw new Error(`No SAMLRequest parameter found in redirect URL: ${redirectUrl}`);
  }

  const xml = (await inflateRawAsync(Buffer.from(samlRequestB64, 'base64'))).toString('utf-8');

  const idMatch = xml.match(/\bID="([^"]+)"/);
  if (!idMatch) {
    throw new Error(`Could not extract AuthnRequest ID from XML: ${xml.slice(0, 300)}`);
  }
  return idMatch[1];
}

export function buildSignedSamlResponse(teamId: string, email: string, inResponseTo: string): string {
  const issueInstant = new Date().toISOString();
  const assertionId = `a-${randomUUID()}`;
  const responseId = `r-${randomUUID()}`;
  const notBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const notOnOrAfter = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  // audience must match the SP entityId configured in the fixture
  const spEntityId = `https://getjetstream.app/saml/sp/${teamId}`;

  const assertion = `
    <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${assertionId}" IssueInstant="${issueInstant}" Version="2.0">
      <saml:Subject>
        <saml:NameID>${email}</saml:NameID>
      </saml:Subject>
      <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
        <saml:AudienceRestriction>
          <saml:Audience>${spEntityId}</saml:Audience>
        </saml:AudienceRestriction>
      </saml:Conditions>
      <saml:AttributeStatement>
        <saml:Attribute Name="email"><saml:AttributeValue>${email}</saml:AttributeValue></saml:Attribute>
        <saml:Attribute Name="firstName"><saml:AttributeValue>Test</saml:AttributeValue></saml:Attribute>
        <saml:Attribute Name="lastName"><saml:AttributeValue>User</saml:AttributeValue></saml:Attribute>
        <saml:Attribute Name="role"><saml:AttributeValue>ADMIN</saml:AttributeValue></saml:Attribute>
      </saml:AttributeStatement>
    </saml:Assertion>`;

  const response = `
    <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${responseId}" Version="2.0" IssueInstant="${issueInstant}" InResponseTo="${inResponseTo}" Destination="${serverUrl}/api/auth/sso/saml/${teamId}/acs">
      ${assertion}
    </samlp:Response>`;

  const sig = new SignedXml({
    privateKey: idpPrivateKey,
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    idAttribute: 'ID',
  });
  sig.addReference({
    xpath: `//*[@ID='${assertionId}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.computeSignature(response, {
    prefix: 'ds',
    location: { reference: `//*[@ID='${assertionId}']`, action: 'append' },
  });

  return Buffer.from(sig.getSignedXml()).toString('base64');
}
