import { TeamLoginConfigRequest } from '@jetstream/types';
import { Card, Checkbox, fireToast, Grid, GridCol, Spinner } from '@jetstream/ui';
import classNames from 'classnames';
import { useEffect, useState } from 'react';

function isItemDirty(current: Set<string>, original: Set<string>, key: string) {
  return current.has(key) !== original.has(key);
}

function getFormData(loginConfiguration: TeamLoginConfigRequest) {
  return {
    data: {
      requireMfa: loginConfiguration.requireMfa,
      allowedMfaMethods: new Set(loginConfiguration.allowedMfaMethods),
      allowedProviders: new Set(loginConfiguration.allowedProviders),
      allowIdentityLinking: loginConfiguration.allowIdentityLinking,
      // domain: loginConfiguration.domains[0] || '',
    },
    originalData: {
      requireMfa: loginConfiguration.requireMfa,
      allowedMfaMethods: new Set(loginConfiguration.allowedMfaMethods),
      allowedProviders: new Set(loginConfiguration.allowedProviders),
      allowIdentityLinking: loginConfiguration.allowIdentityLinking,
      // domain: loginConfiguration.domains[0] || '',
    },
  };
}

export interface TeamLoginConfigurationProps {
  loginConfiguration: TeamLoginConfigRequest;
  onUpdate: (team: TeamLoginConfigRequest) => Promise<void>;
}

export function TeamLoginConfiguration({ loginConfiguration, onUpdate }: TeamLoginConfigurationProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => getFormData(loginConfiguration));

  const [errors, setErrors] = useState(() => ({
    hasError: false,
    allowedMfaMethods: false as string | false,
    allowedProviders: false as string | false,
    // requireMfa: false as string | false,
    // allowIdentityLinking: false as string | false,
    // domain: false as string | false,
  }));

  const [dirty, setDirty] = useState(() => ({
    isDirty: false,
    requireMfa: false,
    allowedMfaMethods: {
      otp: false,
      email: false,
    },
    allowedProviders: {
      credentials: false,
      google: false,
      salesforce: false,
    },
    allowIdentityLinking: false,
  }));

  useEffect(() => {
    const userDate = formData.data;
    const originalData = formData.originalData;

    setDirty((prev) => {
      const newValue = { ...prev, allowedMfaMethods: { ...prev.allowedMfaMethods }, allowedProviders: { ...prev.allowedProviders } };
      newValue.requireMfa = userDate.requireMfa !== originalData.requireMfa;

      newValue.allowedMfaMethods.otp = isItemDirty(userDate.allowedMfaMethods, originalData.allowedMfaMethods, 'otp');
      newValue.allowedMfaMethods.email = isItemDirty(userDate.allowedMfaMethods, originalData.allowedMfaMethods, 'email');

      newValue.allowedProviders.credentials = isItemDirty(userDate.allowedProviders, originalData.allowedProviders, 'credentials');
      newValue.allowedProviders.google = isItemDirty(userDate.allowedProviders, originalData.allowedProviders, 'google');
      newValue.allowedProviders.salesforce = isItemDirty(userDate.allowedProviders, originalData.allowedProviders, 'salesforce');

      newValue.allowIdentityLinking = userDate.allowIdentityLinking !== originalData.allowIdentityLinking;

      newValue.isDirty =
        newValue.requireMfa ||
        newValue.allowIdentityLinking ||
        newValue.allowedMfaMethods.otp ||
        newValue.allowedMfaMethods.email ||
        newValue.allowedProviders.credentials ||
        newValue.allowedProviders.google ||
        newValue.allowedProviders.salesforce;

      return newValue;
    });

    setErrors((prev) => {
      const allowedMfaMethods =
        userDate.allowedMfaMethods.size === 0 ? 'At least one Multi-Factor Authentication method must be selected.' : false;
      const allowedProviders = userDate.allowedProviders.size === 0 ? 'At least one login provider must be selected.' : false;

      return {
        ...prev,
        allowedMfaMethods,
        allowedProviders,
        hasError: !!allowedMfaMethods || !!allowedProviders,
      };
    });
  }, [formData]);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    try {
      setLoading(true);
      const data: TeamLoginConfigRequest = {
        requireMfa: formData.data.requireMfa,
        allowedMfaMethods: Array.from(formData.data.allowedMfaMethods),
        allowedProviders: Array.from(formData.data.allowedProviders),
        allowIdentityLinking: formData.data.allowIdentityLinking,
        // domains: [formData.data.domain],
      };
      await onUpdate(data);
    } catch (ex) {
      fireToast({
        type: 'error',
        message: 'There was a problem updating your team, try again or contact support for assistance.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className="slds-m-bottom_medium slds-card_boundary"
      title="Team Configuration"
      icon={{ type: 'standard', icon: 'settings' }}
      actions={
        <button
          form="team-login-configuration-form"
          type="submit"
          className="slds-button slds-button_brand"
          disabled={!dirty.isDirty || errors.hasError || loading}
        >
          Save
        </button>
      }
    >
      <form id="team-login-configuration-form" className="slds-is-relative slds-m-top_small" onSubmit={onSubmit}>
        {loading && <Spinner />}
        <Grid wrap gutters guttersSize="large">
          <GridCol size={12} sizeMedium={6} sizeLarge={4}>
            <fieldset className="slds-form-element">
              <legend className="slds-form-element__legend slds-form-element__label">General Settings</legend>
              <Checkbox
                id="requireMfa"
                checked={formData.data.requireMfa}
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.requireMfa })}
                label="Require Multi-Factor Authentication"
                labelHelp="Enabling this will require all users to set up Multi-Factor Authentication before they can log in. Users that do not have MFA set up will be prompted to do so on their next login."
                onChange={(value) => setFormData((prev) => ({ ...prev, data: { ...prev.data, requireMfa: value } }))}
              />

              <Checkbox
                id="allowIdentityLinking"
                checked={formData.data.allowIdentityLinking}
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowIdentityLinking })}
                label="Allow linking additional identities"
                labelHelp="Enabling this will allow users to link additional identities (e.g., Google, Salesforce) to their account."
                onChange={(value) => setFormData((prev) => ({ ...prev, data: { ...prev.data, allowIdentityLinking: value } }))}
              />
            </fieldset>
          </GridCol>
          <GridCol size={12} sizeMedium={6} sizeLarge={4}>
            <fieldset className="slds-form-element">
              <legend className="slds-form-element__legend slds-form-element__label">Allowed Multi-Factor Options</legend>
              <Checkbox
                id="allowedMfaMethods-otp"
                checked={formData.data.allowedMfaMethods.has('otp')}
                label="Authenticator App (OTP)"
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowedMfaMethods.otp })}
                onChange={(value) =>
                  setFormData((prev) => {
                    const newSet = new Set(prev.data.allowedMfaMethods);
                    value ? newSet.add('otp') : newSet.delete('otp');
                    return { ...prev, data: { ...prev.data, allowedMfaMethods: newSet } };
                  })
                }
              />
              <Checkbox
                id="allowedMfaMethods-email"
                checked={formData.data.allowedMfaMethods.has('email')}
                label="Email"
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowedMfaMethods.email })}
                onChange={(value) =>
                  setFormData((prev) => {
                    const newSet = new Set(prev.data.allowedMfaMethods);
                    value ? newSet.add('email') : newSet.delete('email');
                    return { ...prev, data: { ...prev.data, allowedMfaMethods: newSet } };
                  })
                }
              />
              {!!errors.allowedMfaMethods && <span className="slds-text-color_error">{errors.allowedMfaMethods}</span>}
            </fieldset>
          </GridCol>
          <GridCol size={12} sizeMedium={6} sizeLarge={4}>
            <fieldset className="slds-form-element">
              <legend className="slds-form-element__legend slds-form-element__label">Allowed Login Providers</legend>
              <Checkbox
                id="allowedProviders-credentials"
                checked={formData.data.allowedProviders.has('credentials')}
                label="Username + Password"
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowedProviders.credentials })}
                onChange={(value) =>
                  setFormData((prev) => {
                    const newSet = new Set(prev.data.allowedProviders);
                    value ? newSet.add('credentials') : newSet.delete('credentials');
                    return { ...prev, data: { ...prev.data, allowedProviders: newSet } };
                  })
                }
              />
              <Checkbox
                id="allowedProviders-google"
                checked={formData.data.allowedProviders.has('google')}
                label="Google"
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowedProviders.google })}
                onChange={(value) =>
                  setFormData((prev) => {
                    const newSet = new Set(prev.data.allowedProviders);
                    value ? newSet.add('google') : newSet.delete('google');
                    return { ...prev, data: { ...prev.data, allowedProviders: newSet } };
                  })
                }
              />
              <Checkbox
                id="allowedProviders-salesforce"
                checked={formData.data.allowedProviders.has('salesforce')}
                label="Salesforce"
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowedProviders.salesforce })}
                onChange={(value) =>
                  setFormData((prev) => {
                    const newSet = new Set(prev.data.allowedProviders);
                    value ? newSet.add('salesforce') : newSet.delete('salesforce');
                    return { ...prev, data: { ...prev.data, allowedProviders: newSet } };
                  })
                }
              />
              {!!errors.allowedProviders && <span className="slds-text-color_error">{errors.allowedProviders}</span>}
            </fieldset>
          </GridCol>
        </Grid>
      </form>
    </Card>
  );
}
