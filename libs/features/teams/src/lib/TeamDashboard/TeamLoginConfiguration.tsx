import { getErrorMessage } from '@jetstream/shared/utils';
import { LoginConfigurationIdentityDisplayNames, TeamLoginConfigRequest } from '@jetstream/types';
import { Card, Checkbox, fireToast, Grid, GridCol, Spinner } from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';

function isItemDirty(current: Set<string>, original: Set<string>, key: string) {
  return current.has(key) !== original.has(key);
}

function getFormData(loginConfiguration: TeamLoginConfigRequest) {
  return {
    data: {
      requireMfa: loginConfiguration.requireMfa,
      ssoRequireMfa: loginConfiguration.ssoRequireMfa,
      allowedMfaMethods: new Set(loginConfiguration.allowedMfaMethods),
      allowedProviders: new Set(loginConfiguration.allowedProviders),
      allowIdentityLinking: loginConfiguration.allowIdentityLinking,
      autoAddToTeam: loginConfiguration.autoAddToTeam,
    },
    originalData: {
      requireMfa: loginConfiguration.requireMfa,
      ssoRequireMfa: loginConfiguration.ssoRequireMfa,
      allowedMfaMethods: new Set(loginConfiguration.allowedMfaMethods),
      allowedProviders: new Set(loginConfiguration.allowedProviders),
      allowIdentityLinking: loginConfiguration.allowIdentityLinking,
      autoAddToTeam: loginConfiguration.autoAddToTeam,
    },
  };
}

export interface TeamLoginConfigurationProps {
  loginConfiguration: TeamLoginConfigRequest;
  hasSsoConfigured: boolean;
  ssoIsActive: boolean;
  onUpdate: (team: TeamLoginConfigRequest) => Promise<void>;
}

export function TeamLoginConfiguration({ loginConfiguration, hasSsoConfigured, ssoIsActive, onUpdate }: TeamLoginConfigurationProps) {
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => getFormData(loginConfiguration));

  const [errors, setErrors] = useState(() => ({
    hasError: false,
    allowedMfaMethods: false as string | false,
    allowedProviders: false as string | false,
    autoAddToTeam: false as string | false,
    // requireMfa: false as string | false,
    // ssoRequireMfa: false as string | false,
    // allowIdentityLinking: false as string | false,
    // domain: false as string | false,
  }));

  const [dirty, setDirty] = useState(() => ({
    isDirty: false,
    requireMfa: false,
    ssoRequireMfa: false,
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
    autoAddToTeam: false,
  }));

  const isReadOnly = ability.cannot('update', 'Team');

  useEffect(() => {
    const userData = formData.data;
    const originalData = formData.originalData;

    setDirty((prev) => {
      const newValue = { ...prev, allowedMfaMethods: { ...prev.allowedMfaMethods }, allowedProviders: { ...prev.allowedProviders } };
      newValue.requireMfa = userData.requireMfa !== originalData.requireMfa;
      newValue.ssoRequireMfa = userData.ssoRequireMfa !== originalData.ssoRequireMfa;

      newValue.allowedMfaMethods.otp = isItemDirty(userData.allowedMfaMethods, originalData.allowedMfaMethods, 'otp');
      newValue.allowedMfaMethods.email = isItemDirty(userData.allowedMfaMethods, originalData.allowedMfaMethods, 'email');

      newValue.allowedProviders.credentials = isItemDirty(userData.allowedProviders, originalData.allowedProviders, 'credentials');
      newValue.allowedProviders.google = isItemDirty(userData.allowedProviders, originalData.allowedProviders, 'google');
      newValue.allowedProviders.salesforce = isItemDirty(userData.allowedProviders, originalData.allowedProviders, 'salesforce');

      newValue.allowIdentityLinking = userData.allowIdentityLinking !== originalData.allowIdentityLinking;

      newValue.autoAddToTeam = userData.autoAddToTeam !== originalData.autoAddToTeam;

      newValue.isDirty =
        newValue.requireMfa ||
        newValue.ssoRequireMfa ||
        newValue.allowIdentityLinking ||
        newValue.autoAddToTeam ||
        newValue.allowedMfaMethods.otp ||
        newValue.allowedMfaMethods.email ||
        newValue.allowedProviders.credentials ||
        newValue.allowedProviders.google ||
        newValue.allowedProviders.salesforce;

      return newValue;
    });

    setErrors((prev) => {
      const allowedMfaMethods =
        userData.allowedMfaMethods.size === 0 ? 'At least one Multi-Factor Authentication method must be selected.' : false;
      const allowedProviders = userData.allowedProviders.size === 0 ? 'At least one login provider must be selected.' : false;

      return {
        ...prev,
        allowedMfaMethods,
        allowedProviders,
        hasError: !!allowedMfaMethods || !!allowedProviders,
      };
    });
  }, [formData]);

  async function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault();
    try {
      setLoading(true);
      const payload = formData.data;
      const data: TeamLoginConfigRequest = {
        requireMfa: payload.requireMfa,
        allowedMfaMethods: Array.from(payload.allowedMfaMethods),
        allowedProviders: Array.from(payload.allowedProviders),
        allowIdentityLinking: payload.allowIdentityLinking,
        autoAddToTeam: payload.autoAddToTeam,
        ssoRequireMfa: payload.ssoRequireMfa,
      };
      await onUpdate(data);
    } catch (ex) {
      fireToast({
        type: 'error',
        message: getErrorMessage(ex) || 'There was a problem updating your team, try again or contact support for assistance.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className="slds-m-bottom_medium slds-card_boundary"
      title="Login Configuration"
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
                disabled={isReadOnly}
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.requireMfa })}
                label="Require Multi-Factor Authentication"
                labelHelp="Enabling this will require all users to set up Multi-Factor Authentication before they can log in. Users that do not have MFA set up will be prompted to do so on their next login."
                onChange={(value) => setFormData((prev) => ({ ...prev, data: { ...prev.data, requireMfa: value } }))}
              />

              {hasSsoConfigured && (
                <Checkbox
                  id="ssoRequireMfa"
                  checked={formData.data.ssoRequireMfa}
                  disabled={isReadOnly}
                  labelClassName={classNames({ 'active-item-yellow-bg': dirty.ssoRequireMfa })}
                  label="Require SSO Multi-Factor Authentication"
                  labelHelp="When you have SSO configured, set this to true for Jetstream to enforce MFA when the user logs in using SSO. If your identity provider has MFA enabled, you can set this to false to avoid prompting users for MFA twice during SSO login."
                  onChange={(value) => setFormData((prev) => ({ ...prev, data: { ...prev.data, ssoRequireMfa: value } }))}
                />
              )}

              <Checkbox
                id="allowIdentityLinking"
                checked={formData.data.allowIdentityLinking}
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
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
                disabled={isReadOnly}
                label={LoginConfigurationIdentityDisplayNames.credentials}
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
                label={LoginConfigurationIdentityDisplayNames.google}
                disabled={isReadOnly}
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
                disabled={isReadOnly}
                label={LoginConfigurationIdentityDisplayNames.salesforce}
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.allowedProviders.salesforce })}
                labelHelp="Login with Salesforce requires using a production environment. The connected app name is 'Jetstream Auth' and may require installation after the first login attempt depending on your login configuration."
                onChange={(value) =>
                  setFormData((prev) => {
                    const newSet = new Set(prev.data.allowedProviders);
                    value ? newSet.add('salesforce') : newSet.delete('salesforce');
                    return { ...prev, data: { ...prev.data, allowedProviders: newSet } };
                  })
                }
              />
              {hasSsoConfigured && (
                <Checkbox
                  id="allowedProviders-sso"
                  checked={ssoIsActive}
                  disabled
                  label="Single Sign-On (SSO)"
                  labelHelp={
                    ssoIsActive
                      ? 'Enable Single Sign-On to allow as a login method'
                      : 'Single Sign-On is always allowed if the configuration is active.'
                  }
                />
              )}
              {!!errors.allowedProviders && <span className="slds-text-color_error">{errors.allowedProviders}</span>}
            </fieldset>
          </GridCol>
          {dirty.isDirty && (
            <GridCol size={12}>
              <div className="slds-m-top_medium slds-text-body_small slds-text-color_weak">
                <p>Any logged in users that no longer meet the login configuration requirements will be logged out.</p>
                {dirty.requireMfa && formData.data.requireMfa && (
                  <p>If required, users will be prompted to enroll in an MFA the next time they log in.</p>
                )}
              </div>
            </GridCol>
          )}
        </Grid>
      </form>
    </Card>
  );
}
