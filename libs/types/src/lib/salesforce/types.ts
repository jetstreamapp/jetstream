export type SalesforceOrgEdition =
  | 'Team Edition'
  | 'Professional Edition'
  | 'Enterprise Edition'
  | 'Developer Edition'
  | 'Personal Edition'
  | 'Unlimited Edition'
  | 'Contact Manager Edition'
  | 'Base Edition';

export type SalesforceOrgLocaleKey =
  | 'en_US'
  | 'de'
  | 'es'
  | 'fr'
  | 'it'
  | 'ja'
  | 'sv'
  | 'ko'
  | 'zh_TW'
  | 'zh_CN'
  | 'pt_BR'
  | 'nl_NL'
  | 'da'
  | 'th'
  | 'fi'
  | 'ru'
  | 'es_MX'
  | 'no';

export interface SObjectOrganization {
  Name?: string;
  Country?: string;
  OrganizationType?: SalesforceOrgEdition;
  InstanceName?: string;
  IsSandbox?: boolean;
  LanguageLocaleKey?: SalesforceOrgLocaleKey;
  NamespacePrefix?: string;
  TrialExpirationDate?: string;
}

export interface FieldDefinition {
  Id: string;
  QualifiedApiName: string;
  Label: string;
  MasterLabel: string;
  DataType: string;
  ValueTypeId: string;
  ReferenceTo: {
    referenceTo: string[] | null;
  };
  ExtraTypeInfo: string | null;
  PublisherId: string | null;
  RelationshipName: string | null;
  LastModifiedBy: {
    Name: string;
  } | null;
  LastModifiedDate: string | null;
  IsCompound: boolean;
  IsHighScaleNumber: boolean;
  IsHtmlFormatted: boolean;
  IsNameField: boolean;
  IsNillable: boolean;
  IsCalculated: boolean;
  IsApiFilterable: boolean;
  IsApiGroupable: boolean;
  IsApiSortable: boolean;
  IsPolymorphicForeignKey: boolean;
}

export interface ErrorResult {
  errors: {
    fields: string[];
    message: string;
    statusCode: string;
  }[];
  success: false;
}

export interface SuccessResult {
  id: string;
  success: true;
}
// NOTE: this type is returned for composite API if an array of data is passed to SFDC
// if one record, then the source in the jsforce type library is used
export type RecordResult = SuccessResult | ErrorResult;
