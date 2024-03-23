export type SoapNil = { $: { 'xsi:nil': 'true' } };

export type SalesforceOrgEdition =
  | 'Team Edition'
  | 'Professional Edition'
  | 'Enterprise Edition'
  | 'Developer Edition'
  | 'Personal Edition'
  | 'Unlimited Edition'
  | 'Contact Manager Edition'
  | 'Base Edition';

export interface SObjectOrganization {
  Name?: string;
  Country?: string;
  OrganizationType?: SalesforceOrgEdition;
  InstanceName?: string;
  IsSandbox?: boolean;
  LanguageLocaleKey?: string;
  NamespacePrefix?: string;
  TrialExpirationDate?: string;
}

export interface SalesforceUserIdentity {
  id: string;
  asserted_user: boolean;
  user_id: string;
  organization_id: string;
  username: string;
  nick_name: string;
  display_name: string;
  email: string;
  email_verified: boolean;
  first_name: string;
  last_name: string;
  timezone: string;
  photos?: {
    picture: string;
    thumbnail: string;
  };
  addr_street?: string;
  addr_city?: string;
  addr_state?: string;
  addr_country: string;
  addr_zip?: string;
  mobile_phone?: string;
  mobile_phone_verified: boolean;
  is_lightning_login_user: boolean;
  status: {
    created_date?: string;
    body?: string;
  };
  urls: Record<string, string>;
  active: boolean;
  user_type: string;
  language: string;
  locale: string;
  utcOffset: number;
  last_modified_date: string;
}
