import { SettingsToggleRow } from './layout/SettingsSection';

export interface SalesforceAutoLoginSettingProps {
  skipFrontdoorLogin: boolean;
  onChange: (skipFrontdoorLogin: boolean) => void;
}

/**
 * Shown as a positive "log in automatically" toggle - the stored preference is the inverse
 * (`skipFrontdoorLogin`), which made the old "Don't auto-login" wording a double negative.
 */
export const SalesforceAutoLoginSetting = ({ skipFrontdoorLogin, onChange }: SalesforceAutoLoginSettingProps) => {
  return (
    <SettingsToggleRow
      id="setting-salesforce-auto-login"
      title="Log in automatically when opening Salesforce links"
      description="Jetstream signs you in to Salesforce when you open a Salesforce link. Turn this off if links ask for multi-factor authentication or send you through SSO again - links also open faster when you are already logged in to Salesforce."
      checked={!skipFrontdoorLogin}
      onChange={(autoLogin) => onChange(!autoLogin)}
    />
  );
};
