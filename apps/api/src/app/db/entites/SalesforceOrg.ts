import { Entity, Column, PrimaryGeneratedColumn, BaseEntity, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { SalesforceOrgEdition, SalesforceOrgLocaleKey } from '@jetstream/types';
import { SalesforceOrgUi } from '@jetstream/types';
import { Exclude, classToPlain } from 'class-transformer';

@Entity()
export class SalesforceOrg extends BaseEntity {
  constructor(jetstreamUserId: string, uiOrg?: SalesforceOrgUi) {
    super();
    this.jetstreamUserId = jetstreamUserId;
    if (uiOrg) {
      this.initFromUiOrg(uiOrg);
    }
  }

  initFromUiOrg(uiOrg: SalesforceOrgUi) {
    this.uniqueId = uiOrg.uniqueId ?? this.uniqueId;
    this.filterText = uiOrg.filterText ?? this.filterText;
    this.accessToken = uiOrg.accessToken ?? this.accessToken;
    this.instanceUrl = uiOrg.instanceUrl ?? this.instanceUrl;
    this.loginUrl = uiOrg.loginUrl ?? this.loginUrl;
    this.userId = uiOrg.userId ?? this.userId;
    this.email = uiOrg.email ?? this.email;
    this.organizationId = uiOrg.organizationId ?? this.organizationId;
    this.username = uiOrg.username ?? this.username;
    this.displayName = uiOrg.displayName ?? this.displayName;
    this.thumbnail = uiOrg.thumbnail ?? this.thumbnail;
    this.apiVersion = uiOrg.apiVersion ?? this.apiVersion;
    this.orgName = uiOrg.orgName ?? this.orgName;
    this.orgCountry = uiOrg.orgCountry ?? this.orgCountry;
    this.orgOrganizationType = uiOrg.orgOrganizationType ?? this.orgOrganizationType;
    this.orgInstanceName = uiOrg.orgInstanceName ?? this.orgInstanceName;
    this.orgIsSandbox = uiOrg.orgIsSandbox ?? this.orgIsSandbox;
    this.orgLanguageLocaleKey = uiOrg.orgLanguageLocaleKey ?? this.orgLanguageLocaleKey;
    this.orgNamespacePrefix = uiOrg.orgNamespacePrefix ?? this.orgNamespacePrefix;
    this.orgTrialExpirationDate = uiOrg.orgTrialExpirationDate ?? this.orgTrialExpirationDate;
    this.connectionError = null;
  }

  @PrimaryGeneratedColumn()
  @Exclude()
  id: number;

  @Column()
  @Exclude()
  jetstreamUserId: string;

  @Column()
  uniqueId: string;

  @Column()
  filterText: string;

  @Column()
  @Exclude()
  accessToken: string;

  @Column()
  instanceUrl: string;

  @Column()
  loginUrl: string;

  @Column({ length: 18 })
  userId: string;

  @Column()
  email: string;

  @Column({ length: 18 })
  organizationId: string;

  @Column()
  username: string;

  @Column()
  displayName: string;

  @Column({ nullable: true })
  thumbnail?: string;

  @Column({ nullable: true })
  apiVersion?: string;

  @Column({ nullable: true })
  orgName?: string;

  @Column({ nullable: true })
  orgCountry?: string;

  @Column('enum', {
    nullable: true,
    enum: [
      'Team Edition',
      'Professional Edition',
      'Enterprise Edition',
      'Developer Edition',
      'Personal Edition',
      'Unlimited Edition',
      'Contact Manager Edition',
      'Base Edition',
    ],
  })
  orgOrganizationType?: SalesforceOrgEdition;

  @Column({ nullable: true })
  orgInstanceName?: string;

  @Column({ nullable: true })
  orgIsSandbox?: boolean;

  @Column('enum', {
    nullable: true,
    enum: ['en_US', 'de', 'es', 'fr', 'it', 'ja', 'sv', 'ko', 'zh_TW', 'zh_CN', 'pt_BR', 'nl_NL', 'da', 'th', 'fi', 'ru', 'es_MX', 'no'],
  })
  orgLanguageLocaleKey?: SalesforceOrgLocaleKey;

  @Column({ nullable: true })
  orgNamespacePrefix?: string;

  @Column('date', { nullable: true })
  orgTrialExpirationDate?: string;

  @Column({ nullable: true })
  connectionError?: string;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  /**
   * This ensures that specific properties will be omitted when serialized
   */
  toJSON() {
    return classToPlain(this);
  }

  static findByUniqueId(jetstreamUserId: string, uniqueId: string) {
    return this.createQueryBuilder('salesforce_org')
      .where('salesforce_org.jetstreamUserId = :jetstreamUserId', { jetstreamUserId })
      .andWhere('salesforce_org.uniqueId = :uniqueId', { uniqueId })
      .cache(true, 3000)
      .getOne();
  }

  static findByUserId(jetstreamUserId: string) {
    return this.createQueryBuilder('salesforce_org')
      .where('salesforce_org.jetstreamUserId = :jetstreamUserId', { jetstreamUserId })
      .getMany();
  }
}
