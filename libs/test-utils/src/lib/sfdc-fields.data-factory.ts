import { EntityParticleRecord, Field, FieldWithRelatedEntities } from '@jetstream/types';
import { Factory } from 'fishery';

export function buildLookupField(name = 'Account') {
  return sfdcFieldFactory.build({
    label: name,
    name: `${name}__c`,
    referenceTo: [name],
    relationshipName: `${name}__r`,
    type: 'reference',
  });
}

export function buildStringField(name = 'Name') {
  return sfdcFieldFactory.build({
    label: name,
    name: `${name}__c`,
    type: 'string',
  });
}

export function buildNumberField(name = 'Size') {
  return sfdcFieldFactory.build({
    label: name,
    name: `${name}__c`,
    type: 'double',
  });
}

export function buildCheckboxField(name = 'IsActive') {
  return sfdcFieldFactory.build({
    label: name,
    name: `${name}__c`,
    type: 'boolean',
  });
}

export function buildPicklistField(name = 'CurrencyIsoCode') {
  return sfdcFieldFactory.build({
    label: name,
    name: `${name}__c`,
    type: 'picklist',
    picklistValues: [
      { active: true, defaultValue: false, label: 'British Pound', validFor: null, value: 'GBP' },
      { active: true, defaultValue: false, label: 'Mexican Peso', validFor: null, value: 'MXN' },
      { active: true, defaultValue: true, label: 'U.S. Dollar', validFor: null, value: 'USD' },
    ],
  });
}

export function buildFieldsWithRelated(): FieldWithRelatedEntities[] {
  return [
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'Account',
      name: 'Account',
      type: 'reference',
      referenceTo: ['Account'],
      relationshipName: 'Account',
      field: { ...buildLookupField('Account'), typeLabel: 'Lookup(Account)' },
    }),
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'Account (2)',
      name: 'Account__c',
      type: 'reference',
      referenceTo: ['Account'],
      relationshipName: 'Account__r',
      field: { ...buildLookupField('Account'), typeLabel: 'Lookup(Account)' },
    }),
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'Name',
      name: 'Name',
      type: 'string',
      field: { ...buildStringField('Name'), typeLabel: 'test' },
    }),
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'External Id',
      name: 'External_Id__c',
      type: 'string',
      externalId: true,
      field: { ...buildStringField('ExternalId'), typeLabel: 'test' },
    }),
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'Size',
      name: 'Size',
      type: 'double',
      field: { ...buildNumberField('Size'), typeLabel: 'test' },
    }),
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'Is Active',
      name: 'IsActive',
      type: 'boolean',
      field: { ...buildCheckboxField('IsActive'), typeLabel: 'test' },
    }),
    sfdcFieldWithRelatedTypesFactory.build({
      label: 'Currency Iso Code',
      name: 'CurrencyIsoCode',
      type: 'picklist',
      field: { ...buildPicklistField('CurrencyIsoCode'), typeLabel: 'test' },
    }),
  ];
}

export const sfdcFieldWithRelatedTypesFactory: Factory<FieldWithRelatedEntities> = Factory.define<FieldWithRelatedEntities>(
  ({ sequence }) => {
    return {
      label: 'Name',
      name: 'Name',
      type: 'string',
      soapType: 'string',
      typeLabel: 'Name',
      externalId: false,
      referenceTo: null,
      relationshipName: null,
      field: { ...sfdcFieldFactory.build(), typeLabel: 'Name' },
    } satisfies FieldWithRelatedEntities;
  },
);

export const sfdcFieldFactory: Factory<Field> = Factory.define<Field>(({ sequence }) => {
  return {
    label: 'Name',
    name: 'Name__c',
    referenceTo: null,
    relationshipName: null,
    type: 'string',
    aggregatable: true,
    aiPredictionField: false,
    autoNumber: false,
    byteLength: 18,
    calculated: false,
    calculatedFormula: null,
    cascadeDelete: false,
    caseSensitive: false,
    compoundFieldName: null,
    controllerName: null,
    createable: true,
    custom: true,
    defaultValue: null,
    defaultValueFormula: null,
    defaultedOnCreate: false,
    dependentPicklist: false,
    deprecatedAndHidden: false,
    digits: 0,
    displayLocationInDecimal: false,
    encrypted: false,
    externalId: false,
    extraTypeInfo: null,
    filterable: true,
    filteredLookupInfo: null,
    formulaTreatNullNumberAsZero: false,
    groupable: true,
    highScaleNumber: false,
    htmlFormatted: false,
    idLookup: false,
    inlineHelpText: null,
    length: 18,
    mask: null,
    maskType: null,
    nameField: false,
    namePointing: false,
    nillable: true,
    permissionable: true,
    picklistValues: [],
    polymorphicForeignKey: false,
    precision: 0,
    queryByDistance: false,
    referenceTargetField: null,
    relationshipOrder: null,
    restrictedDelete: false,
    restrictedPicklist: false,
    scale: 0,
    searchPrefilterable: true,
    soapType: 'tns:ID',
    sortable: true,
    unique: false,
    updateable: true,
    writeRequiresMasterRead: false,
  } satisfies Field;
});

export const sfdcEntityParticleRecordFactory: Factory<EntityParticleRecord> = Factory.define<EntityParticleRecord>(
  ({ sequence, params }) => {
    const { EntityDefinitionId = 'Account', Name = 'Name', MasterLabel = 'Name', Label } = params;
    return {
      attributes: {
        type: 'EntityParticle',
        url: `/services/data/v65.0/sobjects/EntityParticle/${EntityDefinitionId}.${Name}`,
      },
      Id: `${sequence}`.padStart(15, '0').padEnd(18, 'A'),
      Name,
      EntityDefinitionId,
      EntityDefinition: {
        attributes: {
          type: 'EntityDefinition',
          url: `/services/data/v65.0/sobjects/EntityDefinition/${EntityDefinitionId}`,
        },
        QualifiedApiName: EntityDefinitionId,
      },
      IsIdLookup: false,
      DataType: 'string',
      ValueTypeId: 'string',
      ReferenceTo: {
        referenceTo: null,
      },
      IsCreatable: true,
      IsUpdatable: true,
      Label: Label || `${EntityDefinitionId} ${Name}`,
      MasterLabel,
      QualifiedApiName: params.QualifiedApiName || MasterLabel,
      RelationshipName: null,
    } satisfies EntityParticleRecord;
  },
);
