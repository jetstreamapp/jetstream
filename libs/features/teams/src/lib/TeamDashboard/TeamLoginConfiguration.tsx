import { css } from '@emotion/react';
import { getErrorMessage } from '@jetstream/shared/utils';
import { LoginConfigurationIdentityDisplayNames, TeamLoginConfigRequest } from '@jetstream/types';
import { Card, Checkbox, fireToast, Grid, GridCol, Icon, Input, Spinner } from '@jetstream/ui';
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
      allowedMfaMethods: new Set(loginConfiguration.allowedMfaMethods),
      allowedProviders: new Set(loginConfiguration.allowedProviders),
      allowIdentityLinking: loginConfiguration.allowIdentityLinking,
      autoAddToTeam: loginConfiguration.autoAddToTeam,
      domains: loginConfiguration.domains || [],
    },
    originalData: {
      requireMfa: loginConfiguration.requireMfa,
      allowedMfaMethods: new Set(loginConfiguration.allowedMfaMethods),
      allowedProviders: new Set(loginConfiguration.allowedProviders),
      allowIdentityLinking: loginConfiguration.allowIdentityLinking,
      autoAddToTeam: loginConfiguration.autoAddToTeam,
      domains: loginConfiguration.domains || [],
    },
  };
}

export interface TeamLoginConfigurationProps {
  loginConfiguration: TeamLoginConfigRequest;
  onUpdate: (team: TeamLoginConfigRequest) => Promise<void>;
}

export function TeamLoginConfiguration({ loginConfiguration, onUpdate }: TeamLoginConfigurationProps) {
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(() => getFormData(loginConfiguration));

  const [errors, setErrors] = useState(() => ({
    hasError: false,
    allowedMfaMethods: false as string | false,
    allowedProviders: false as string | false,
    autoAddToTeam: false as string | false,
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
    autoAddToTeam: false,
    domains: false,
  }));

  const isReadOnly = ability.cannot('update', 'Team');

  useEffect(() => {
    const userData = formData.data;
    const originalData = formData.originalData;

    setDirty((prev) => {
      const newValue = { ...prev, allowedMfaMethods: { ...prev.allowedMfaMethods }, allowedProviders: { ...prev.allowedProviders } };
      newValue.requireMfa = userData.requireMfa !== originalData.requireMfa;

      newValue.allowedMfaMethods.otp = isItemDirty(userData.allowedMfaMethods, originalData.allowedMfaMethods, 'otp');
      newValue.allowedMfaMethods.email = isItemDirty(userData.allowedMfaMethods, originalData.allowedMfaMethods, 'email');

      newValue.allowedProviders.credentials = isItemDirty(userData.allowedProviders, originalData.allowedProviders, 'credentials');
      newValue.allowedProviders.google = isItemDirty(userData.allowedProviders, originalData.allowedProviders, 'google');
      newValue.allowedProviders.salesforce = isItemDirty(userData.allowedProviders, originalData.allowedProviders, 'salesforce');

      newValue.allowIdentityLinking = userData.allowIdentityLinking !== originalData.allowIdentityLinking;

      newValue.autoAddToTeam = userData.autoAddToTeam !== originalData.autoAddToTeam;

      newValue.domains =
        userData.domains.length !== originalData.domains.length ||
        userData.domains.some((domain) => !originalData.domains.includes(domain)) ||
        originalData.domains.some((domain) => !userData.domains.includes(domain));

      newValue.isDirty =
        newValue.requireMfa ||
        newValue.allowIdentityLinking ||
        newValue.autoAddToTeam ||
        newValue.domains ||
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

      const autoAddToTeam =
        userData.autoAddToTeam && userData.domains.length === 0
          ? 'You must specify at least one domain to automatically add users to the team.'
          : false;

      return {
        ...prev,
        allowedMfaMethods,
        allowedProviders,
        autoAddToTeam,
        hasError: !!allowedMfaMethods || !!allowedProviders || !!autoAddToTeam,
      };
    });
  }, [formData]);

  async function onSubmit(ev: React.FormEvent<HTMLFormElement>) {
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
        domains: payload.domains,
        // domains: [payload.domain],
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
              {!!errors.allowedProviders && <span className="slds-text-color_error">{errors.allowedProviders}</span>}
            </fieldset>
          </GridCol>
          {/* TODO: Not MVP */}
          {/* <GridCol size={12}>
            <fieldset className="slds-form-element">
              <legend className="slds-form-element__legend slds-form-element__label">Domain Configuration</legend>
              <Checkbox
                id="autoAddToTeam"
                checked={formData.data.autoAddToTeam}
                disabled={isReadOnly}
                label="Automatically add users to team based on email domain"
                labelHelp={
                  <>
                    <p>
                      Enabling this will automatically add users to the team when they log in with a domain that matches the allowed
                      domains.
                    </p>
                    <p className="slds-m-top_x-small">
                      New users will consume a license upon signing up and this may trigger an invoice to be generated.
                    </p>
                    <p className="slds-m-top_x-small">If you don't have any available licenses, the user will not be able to sign up.</p>
                  </>
                }
                errorMessage={errors.autoAddToTeam}
                errorMessageId="autoAddToTeam-error"
                hasError={!!errors.autoAddToTeam}
                labelClassName={classNames({ 'active-item-yellow-bg': dirty.autoAddToTeam })}
                onChange={(value) => setFormData((prev) => ({ ...prev, data: { ...prev.data, autoAddToTeam: value } }))}
              />
              {formData.data.autoAddToTeam && (
                <DomainInputs
                  domains={formData.data.domains}
                  disabled={isReadOnly}
                  onChange={(domains) => setFormData((prev) => ({ ...prev, data: { ...prev.data, domains } }))}
                />
              )}
            </fieldset>
          </GridCol> */}
        </Grid>
      </form>
      {dirty.isDirty && (
        <div className="slds-m-top_medium slds-text-body_small slds-text-color_weak">
          <p>Any logged in users that no longer meet the login configuration requirements will be logged out.</p>
          {dirty.requireMfa && formData.data.requireMfa && (
            <p>If required, users will be prompted to enroll in an MFA the next time they log in.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function DomainInputs({
  domains: domainsInput,
  disabled,
  onChange,
}: {
  disabled: boolean;
  domains: string[];
  onChange: (domains: string[]) => void;
}) {
  const [domains, setDomains] = useState(domainsInput);
  const [addDomainActive, setAddDomainActive] = useState(() => !domainsInput.length);

  function onAddDomain(domain: string) {
    if (domain && !domains.includes(domain.trim())) {
      const newDomains = [...domains, domain.trim()];
      setDomains(newDomains);
      onChange(newDomains);
    }
    setAddDomainActive(false);
  }

  function onRemoveDomain(domainToRemove: string) {
    const newDomains = domains.filter((d) => d !== domainToRemove);
    setDomains(newDomains);
    onChange(newDomains);
  }

  return (
    <div>
      <Input label="Domains">
        {domains.map((domain, index) => (
          <Grid key={index} verticalAlign="center" className="slds-m-bottom_xx-small">
            <div className="slds-form-element__control">
              <input className="slds-input" type="text" disabled value={domain} />
            </div>
            <div>
              {!disabled && (
                <button
                  className="slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_xx-small"
                  type="button"
                  onClick={() => onRemoveDomain(domain)}
                >
                  <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                </button>
              )}
            </div>
          </Grid>
        ))}
        {addDomainActive && !disabled && (
          <DomainInput
            onCancel={() => {
              setAddDomainActive(false);
            }}
            onSave={(domain) => onAddDomain(domain)}
          />
        )}
        {!addDomainActive && !disabled && (
          <button className="slds-button slds-button_neutral slds-m-top_xx-small" type="button" onClick={() => setAddDomainActive(true)}>
            + Add Domain
          </button>
        )}
      </Input>
    </div>
  );
}

function DomainInput({ onSave, onCancel }: { onSave: (domain: string) => void; onCancel: () => void }) {
  const [domain, setDomain] = useState('');
  const [isValid, setIsValid] = useState(true);

  const isSaveEnabled = domain && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim());

  function handleSave() {
    const _isValid = domain ? /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain.trim()) : true;
    setIsValid(_isValid);
    if (_isValid) {
      onSave(domain.trim());
    }
  }

  // FIXME: form cannot be nested inside a form, so we handle the submit manually
  return (
    <>
      <Grid verticalAlign="end">
        <div>
          <label className="slds-form-element__label">
            New Domain
            <div className="slds-form-element__control">
              <input
                className="slds-input"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSave();
                  }
                }}
              />
            </div>
          </label>
        </div>
        <button
          css={css`
            margin-bottom: 0.125rem;
          `}
          className="slds-button slds-button_brand"
          type="button"
          onClick={() => handleSave()}
          disabled={!isSaveEnabled}
        >
          Save
        </button>
        <button
          css={css`
            margin-bottom: 0.125rem;
          `}
          className="slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_x-small"
          type="button"
          onClick={() => onCancel()}
        >
          <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
        </button>
      </Grid>
      {!isValid && <span className="slds-text-color_error">Enter a valid domain</span>}
    </>
  );
}
