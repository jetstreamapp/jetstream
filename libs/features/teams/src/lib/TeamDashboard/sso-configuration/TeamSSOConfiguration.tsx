import { css } from '@emotion/react';
import { LoginConfigurationWithCallbacks } from '@jetstream/auth/types';
import { deleteOidcConfig, deleteSamlConfig, updateSsoSettings } from '@jetstream/shared/data';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TeamMemberRole, TeamMemberRoleSchema } from '@jetstream/types';
import {
  Badge,
  ButtonGroupContainer,
  Card,
  Checkbox,
  ConfirmationModalPromise,
  DropDown,
  fireToast,
  Grid,
  Icon,
  ScopedNotification,
  Tooltip,
} from '@jetstream/ui';
import { abilityState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import startCase from 'lodash/startCase';
import { useState } from 'react';
import { ConfigureSsoModal } from './ConfigureSsoModal';

export interface TeamSSOConfigurationProps {
  teamId: string;
  ssoConfig: LoginConfigurationWithCallbacks;
  hasVerifiedDomain: boolean;
  onSsoConfigChange: (config: LoginConfigurationWithCallbacks) => void;
  reloadConfig: () => Promise<void>;
}

export function TeamSSOConfiguration({ teamId, ssoConfig, hasVerifiedDomain, onSsoConfigChange, reloadConfig }: TeamSSOConfigurationProps) {
  const ability = useAtomValue(abilityState);
  const hasSsoConfigured = !ssoConfig || ssoConfig.ssoProvider !== 'NONE';
  const [modalOpen, setModalOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const canUpdate = ability.can('update', 'SsoConfiguration');
  const isReadOnly = !canUpdate || ability.cannot('update', 'Team');

  const bypassRoles = new Set(ssoConfig.ssoBypassEnabledRoles);

  async function handleSettingToggle(field: 'ssoEnabled' | 'ssoJitProvisioningEnabled' | 'ssoBypassEnabled', enabled: boolean) {
    try {
      setSavingSettings(true);
      const newSettings = {
        ssoEnabled: ssoConfig.ssoEnabled,
        ssoJitProvisioningEnabled: ssoConfig.ssoJitProvisioningEnabled,
        ssoBypassEnabled: ssoConfig.ssoBypassEnabled,
        ssoBypassEnabledRoles: ssoConfig.ssoBypassEnabledRoles,
        [field]: enabled,
      };

      const updatedConfig = await updateSsoSettings(teamId, newSettings);

      onSsoConfigChange(updatedConfig);

      const messages = {
        ssoEnabled: enabled ? 'SSO enabled successfully' : 'SSO disabled successfully',
        ssoJitProvisioningEnabled: 'JIT provisioning updated successfully',
        ssoBypassEnabled: enabled ? 'SSO bypass enabled' : 'SSO bypass disabled - users must use SSO',
      };

      fireToast({
        type: 'success',
        message: messages[field],
      });
    } catch (error) {
      fireToast({
        type: 'error',
        message: `Failed to update SSO settings: ${getErrorMessage(error)}`,
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleEnabledRoleToggle(role: TeamMemberRole, enabled: boolean) {
    try {
      if (enabled) {
        bypassRoles.add(role);
      } else {
        bypassRoles.delete(role);
      }

      const newBypassRoles = Array.from(bypassRoles);

      if (newBypassRoles.length === 0) {
        fireToast({
          type: 'error',
          message: 'At least one role must be selected to allow SSO bypass.',
        });
        return;
      }

      setSavingSettings(true);
      const newSettings = {
        ssoEnabled: ssoConfig.ssoEnabled,
        ssoJitProvisioningEnabled: ssoConfig.ssoJitProvisioningEnabled,
        ssoBypassEnabled: ssoConfig.ssoBypassEnabled,
        ssoBypassEnabledRoles: newBypassRoles,
      };

      const updatedConfig = await updateSsoSettings(teamId, newSettings);

      onSsoConfigChange(updatedConfig);

      fireToast({
        type: 'success',
        message: 'SSO bypass roles updated successfully',
      });
    } catch (error) {
      fireToast({
        type: 'error',
        message: `Failed to update SSO settings: ${getErrorMessage(error)}`,
      });
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleDelete() {
    try {
      const confirmed = await ConfirmationModalPromise({
        header: 'Delete SSO Configuration',
        content: (
          <>
            <p>Are you sure you want to delete this SSO configuration?</p>
            <p>Users without another valid authentication factor will no longer be able to sign in.</p>
          </>
        ),

        confirm: 'Delete',
        cancel: 'Cancel',
      });

      if (!confirmed) return;

      setSavingSettings(true);

      if (ssoConfig.ssoProvider === 'SAML') {
        await deleteSamlConfig(teamId);
      } else if (ssoConfig.ssoProvider === 'OIDC') {
        await deleteOidcConfig(teamId);
      }

      await reloadConfig();

      fireToast({
        type: 'success',
        message: 'SSO configuration deleted successfully',
      });
    } catch (error) {
      fireToast({
        type: 'error',
        message: `Failed to delete SSO configuration: ${getErrorMessage(error)}`,
      });
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <>
      {modalOpen && (
        <ConfigureSsoModal
          teamId={teamId}
          existingSsoConfig={ssoConfig}
          onClose={(updated) => {
            setModalOpen(false);
            if (updated) {
              reloadConfig();
            }
          }}
        />
      )}

      <Card
        testId="sso-configuration"
        className="slds-m-bottom_medium slds-card_boundary"
        title="SSO Configuration"
        icon={{ type: 'standard', icon: 'portal' }}
        actions={
          // eslint-disable-next-line react/jsx-no-useless-fragment
          <>
            {!isReadOnly && (
              <ButtonGroupContainer>
                <button
                  className="slds-button slds-button_neutral"
                  disabled={isReadOnly || !hasVerifiedDomain}
                  onClick={() => setModalOpen(true)}
                >
                  <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" />
                  {ssoConfig.ssoProvider !== 'NONE' ? 'Configure SSO Provider' : 'Add SSO Provider'}
                </button>
                {ssoConfig.ssoProvider !== 'NONE' && (
                  <DropDown
                    className="slds-button_last"
                    dropDownClassName="slds-dropdown_actions"
                    position="right"
                    onSelected={(id) => {
                      if (id === 'delete') {
                        handleDelete();
                      }
                    }}
                    items={[
                      {
                        id: 'delete',
                        value: 'Delete Configuration',
                        icon: { type: 'utility', icon: 'delete' },
                      },
                    ]}
                  />
                )}
              </ButtonGroupContainer>
            )}
          </>
        }
      >
        {!hasSsoConfigured ? (
          <div>
            <p className="slds-m-bottom_x-small">
              Configure single sign-on (SSO) to allow users to authenticate using your organization's identity provider.
            </p>
            <p className="slds-m-bottom_x-small">
              Only users with email addresses matching your verified domains will be able to sign in using SSO.
            </p>
            <ScopedNotification theme="light" className="slds-m-bottom_small">
              Jetstream supports SAML and OIDC providers like Okta, Azure AD, Google Workspace, and more.
              {!hasVerifiedDomain && (
                <Grid className="">
                  <Icon type="utility" icon="warning" className="slds-icon slds-icon-text-warning slds-m-right_x-small slds-icon_x-small" />
                  <strong>You must have at least one verified domain to configure SSO.</strong>
                </Grid>
              )}
            </ScopedNotification>
          </div>
        ) : (
          <div>
            <Grid vertical>
              <div className="slds-m-bottom_small">
                <div className="slds-text-heading_small slds-m-bottom_x-small">
                  {ssoConfig.ssoProvider === 'OIDC' &&
                    ssoConfig.oidcConfiguration &&
                    (ssoConfig.oidcConfiguration.name || ssoConfig.ssoProvider)}
                  {ssoConfig.ssoProvider === 'SAML' &&
                    ssoConfig.samlConfiguration &&
                    (ssoConfig.samlConfiguration.name || ssoConfig.ssoProvider)}
                  {ssoConfig.ssoEnabled ? (
                    <Badge type="success" className="slds-m-left_small">
                      Active
                    </Badge>
                  ) : (
                    <Badge type="warning" className="slds-m-left_small">
                      Inactive
                    </Badge>
                  )}
                </div>
                {ssoConfig.ssoProvider === 'OIDC' && ssoConfig.oidcConfiguration && (
                  <p className="slds-text-body_small slds-text-color_weak">Issuer: {ssoConfig.oidcConfiguration.issuer}</p>
                )}
                {ssoConfig.ssoProvider === 'SAML' && ssoConfig.samlConfiguration && (
                  <p className="slds-text-body_small slds-text-color_weak">IdP Entity: {ssoConfig.samlConfiguration.idpEntityId}</p>
                )}
                {ssoConfig.ssoProvider === 'SAML' && ssoConfig.samlConfiguration?.idpCertificateExpiresAt && (
                  <p className="slds-text-body_small slds-text-color_weak">
                    IdP Certificate Expires At:{' '}
                    <strong>
                      {new Date(ssoConfig.samlConfiguration.idpCertificateExpiresAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </strong>
                  </p>
                )}
                <p className="slds-text-body_small slds-text-color_weak">
                  Users must have an email address matching one of your verified domains to sign in using SSO. You can use attribute mapping
                  if you need to customize which user attributes are used for email matching.
                </p>
              </div>

              <Checkbox
                id="sso-enabled"
                checked={ssoConfig.ssoEnabled}
                label="Enable SSO"
                disabled={isReadOnly || savingSettings}
                onChange={(checked) => handleSettingToggle('ssoEnabled', checked)}
              />

              <Checkbox
                id="sso-jit"
                checked={ssoConfig.ssoJitProvisioningEnabled}
                label="Auto-create users on first SSO login (JIT Provisioning)"
                labelHelp="If disabled, users must be invited before they can login with SSO"
                disabled={isReadOnly || savingSettings}
                onChange={(checked) => handleSettingToggle('ssoJitProvisioningEnabled', checked)}
              />

              <Checkbox
                id="sso-bypass"
                checked={ssoConfig.ssoBypassEnabled}
                label="Allow non-SSO login methods"
                labelHelp="If disabled, users must use SSO and cannot login with email/password or OAuth providers"
                disabled={isReadOnly || savingSettings}
                onChange={(checked) => handleSettingToggle('ssoBypassEnabled', checked)}
              />

              {ssoConfig.ssoBypassEnabled && (
                <fieldset className="slds-form-element">
                  <legend
                    className="slds-form-element__label slds-truncate"
                    css={css`
                      font-weight: 700;
                      display: flex;
                      align-items: center;
                      gap: 0.5rem;
                    `}
                  >
                    Which roles can bypass SSO?
                    <Tooltip content="It is recommended that you enable Administrators to login using alternative methods, such as Google/Salesforce OAuth or email/password, for emergency access.">
                      <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small cursor-pointer" />
                      <span className="slds-assistive-text">
                        It is recommended that you enable Administrators to login using alternative methods, such as Google/Salesforce OAuth
                        or email/password, for emergency access.
                      </span>
                    </Tooltip>
                  </legend>
                  <Grid>
                    {Object.entries(TeamMemberRoleSchema.enum).map(([key, role]) => (
                      <Checkbox
                        key={`sso-bypass-${role}`}
                        id={`sso-bypass-${role}`}
                        checked={bypassRoles.has(role)}
                        label={startCase(role.toLowerCase())}
                        disabled={isReadOnly || savingSettings}
                        onChange={(checked) => handleEnabledRoleToggle(role, checked)}
                      />
                    ))}
                  </Grid>
                </fieldset>
              )}
            </Grid>
          </div>
        )}
      </Card>
    </>
  );
}
