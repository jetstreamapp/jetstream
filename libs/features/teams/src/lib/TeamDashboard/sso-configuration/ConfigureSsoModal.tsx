import { LoginConfigurationWithCallbacks } from '@jetstream/auth/types';
import { saveOidcConfig, saveSamlConfig } from '@jetstream/shared/data';
import { getErrorMessage, nullifyEmptyStrings } from '@jetstream/shared/utils';
import { fireToast, Modal, Radio, RadioGroup, ScopedNotification, Spinner, ViewDocsLink } from '@jetstream/ui';
import { useState } from 'react';
import { ConfigureSsoOidcForm, ConfigureSsoOidcFormProps } from './ConfigureSsoOidcForm';
import { ConfigureSsoSamlForm, ConfigureSsoSamlFormProps } from './ConfigureSsoSamlForm';

export interface ConfigureSSOModalProps {
  teamId: string;
  existingSsoConfig: LoginConfigurationWithCallbacks | null;
  onClose: (updated?: boolean) => void;
}

export function ConfigureSsoModal({ teamId, existingSsoConfig, onClose }: ConfigureSSOModalProps) {
  const hasExisting = existingSsoConfig && existingSsoConfig.ssoProvider !== 'NONE';
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'OIDC' | 'SAML'>(() => (existingSsoConfig?.ssoProvider === 'SAML' ? 'SAML' : 'OIDC'));
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; authUrl?: string } | null>(null);

  async function handleSave(
    payload:
      | { type: 'OIDC'; data: Parameters<ConfigureSsoOidcFormProps['onSave']>[0] }
      | { type: 'SAML'; data: Parameters<ConfigureSsoSamlFormProps['onSave']>[0] },
  ) {
    try {
      setLoading(true);
      setTestResult(null);

      payload = nullifyEmptyStrings(payload);

      if (payload.type === 'OIDC') {
        await saveOidcConfig(teamId, payload.data);
        fireToast({ type: 'success', message: 'OIDC configuration saved successfully' });
      } else {
        await saveSamlConfig(teamId, payload.data);
        fireToast({ type: 'success', message: 'SAML configuration saved successfully' });
      }

      onClose(true);
    } catch (error) {
      fireToast({
        type: 'error',
        message: `Failed to save SSO configuration: ${getErrorMessage(error)}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      header="Configure SSO Provider"
      tagline={
        <p>
          Refer to the <ViewDocsLink path="/team-management/sso/overview" className="d-inline-block" /> for detailed setup instructions.
        </p>
      }
      size="lg"
      closeOnBackdropClick={false}
      footer={
        <>
          <button className="slds-button slds-button_neutral" disabled={loading} onClick={() => onClose()}>
            Cancel
          </button>
          <button form="sso-form" className="slds-button slds-button_brand slds-is-relative" disabled={loading} type="submit">
            {loading && <Spinner size="x-small" />}
            Save Configuration
          </button>
        </>
      }
      onClose={() => onClose()}
    >
      {!hasExisting && (
        <div className="slds-m-bottom_medium">
          <RadioGroup label="Select SSO Provider">
            <Radio
              name="sso-provider"
              label="OIDC (Okta, Azure AD, Google Workspace, etc.)"
              value="OIDC"
              checked={provider === 'OIDC'}
              onChange={() => setProvider('OIDC')}
            />
            <Radio name="sso-provider" label="SAML 2.0" value="SAML" checked={provider === 'SAML'} onChange={() => setProvider('SAML')} />
          </RadioGroup>
        </div>
      )}

      {provider === 'OIDC' && (
        <ConfigureSsoOidcForm existingSsoConfig={existingSsoConfig} teamId={teamId} onSave={(data) => handleSave({ type: 'OIDC', data })} />
      )}

      {provider === 'SAML' && (
        <ConfigureSsoSamlForm teamId={teamId} existingSsoConfig={existingSsoConfig} onSave={(data) => handleSave({ type: 'SAML', data })} />
      )}

      {testResult && (
        <ScopedNotification theme={testResult.success ? 'success' : 'error'} className="slds-m-top_medium">
          {testResult.message}
          {testResult.authUrl && (
            <div className="slds-m-top_x-small">
              <a href={testResult.authUrl} target="_blank" rel="noopener noreferrer" className="slds-text-link">
                Test SSO Login
              </a>
            </div>
          )}
        </ScopedNotification>
      )}
    </Modal>
  );
}
