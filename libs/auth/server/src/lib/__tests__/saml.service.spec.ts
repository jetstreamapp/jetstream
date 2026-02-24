import { describe, expect, it } from 'vitest';
import { samlService } from '../saml.service';

const sampleMetadata = `
<EntityDescriptor entityID="https://idp.example.com/metadata" xmlns="urn:oasis:names:tc:SAML:2.0:metadata">
  <IDPSSODescriptor>
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>
            MIICsjCCAZqgAwIBAgIBADANBgkqhkiG9w0BAQsFADASMRAwDgYDVQQDEwdFeGFtcGxlMB4XDTIxMDkwMTAwMDAwMFoXDTMxMDgzMTAwMDAwMFowEjEQMA4GA1UEAxMHRXhhbXBsZTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAO71r0hu+6NLtH4fEcxuXfL7U6zG7TzJ7CVv+Lm7LhV9fYkVbo0VqvEXAMPLE3N4lNIatN3L2P76PP7adnPBAOC9nQ2YDMUqZXcTzR3G3xwWC31dPtq6wMjnYQ5/OoT1nczX7a8cdlD3zIBdkLq1ZGCG2MEBNHct7l1P7Ixw7zY2jEfa7lUxsqk+esq0xk+UWuuV0wxNAqYz/2VbsePQgmN6CSFYf3Y2o/E/5/Z9Q5fPj8f5Ow+gxs3s3xqvL/kkE0zc1bVuhzOPQ6wmk0ZmJY9X2PXKRqvwPJg6HfeJB/NNzvOxEC1ui0L1Hev1d6+u/xK0djUCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAfZ5pQet7PyYbd40X14t4Vbpi8Sf2m49S2mWuXw5QPgXLaeXVsYvZNYC6+DXL3pc9XjQUMIPyTV6CkS3FV1I2zgpKx7h0FqbajN48G2GJOeyRD82YuA3Fta1k4mt1k6Z0uZZO9yvR45aG6mVZQ7u4Lno7EEp5R/LepAWgGg7iXlZ3We5prlONJSljY81m7EXAMPLE0s/6O8y6zBzZbJt8j+eQy3Fh7f7Jp+8ViLVEe5f49XFuTUQZY6Nh6iDtaQ==
          </X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso" />
  </IDPSSODescriptor>
</EntityDescriptor>
`;

describe('samlService', () => {
  it('parses IdP metadata and extracts SSO details', async () => {
    const parsed = await samlService.parseIdpMetadata(sampleMetadata);

    expect(parsed.entityId).toBe('https://idp.example.com/metadata');
    expect(parsed.ssoUrl).toBe('https://idp.example.com/sso');
    expect(parsed.certificate?.length).toBeGreaterThan(10);
  });

  it('rejects metadata containing DOCTYPE declarations', async () => {
    const xxePayload = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<EntityDescriptor entityID="https://evil.com">&xxe;</EntityDescriptor>`;
    await expect(samlService.parseIdpMetadata(xxePayload)).rejects.toThrow(/DOCTYPE and ENTITY declarations are not allowed/);
  });

  it('rejects metadata containing ENTITY declarations', async () => {
    const entityPayload = `<?xml version="1.0"?>
<foo><!ENTITY xxe "test"></foo>`;
    await expect(samlService.parseIdpMetadata(entityPayload)).rejects.toThrow(/DOCTYPE and ENTITY declarations are not allowed/);
  });

  it('throws when email is missing in assertion', () => {
    expect(() =>
      samlService.extractUserInfo(
        { attributes: { uid: 'user-1' }, nameID: undefined } as any,
        { email: 'mail', userName: 'uid' },
      ),
    ).toThrow(/Email not found/i);
  });
});
