import { logger } from '@jetstream/shared/client-logger';
import { describeSObject, queryAllUsingOffset } from '@jetstream/shared/data';
import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ApiResponse, ChildRelationship, DescribeSObjectResult, Field, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import {
  ExportOptions,
  ExtendedFieldDefinition,
  FieldDefinitionRecord,
  SobjectExportField,
  SobjectFetchResult,
} from './sobject-export-types';

export const FIELD_DEFINITION_API_FIELDS = new Set<ExtendedFieldDefinition>([
  'BusinessOwnerId',
  'BusinessStatus',
  'ComplianceGroup',
  'IsFieldHistoryTracked',
  'IsFlsEnabled',
  'SecurityClassification',
]);

export async function getSobjectMetadata(org: SalesforceOrgUi, selectedSobjects: string[]): Promise<SobjectFetchResult[]> {
  const CONCURRENT_LIMIT = 7;
  let results: PromiseSettledResult<ApiResponse<DescribeSObjectResult>>[] = [];

  // limit number of concurrent API calls
  const selectedSobjectSets: string[][] = splitArrayToMaxSize(selectedSobjects, CONCURRENT_LIMIT);
  for (const selectedSobjectSet of selectedSobjectSets) {
    const tempResults = await Promise.allSettled(selectedSobjectSet.map((sobject) => describeSObject(org, sobject)));
    results = results.concat(tempResults);
  }

  return selectedSobjects.map((sobject, i) => {
    const result = results[i];
    if (result.status === 'fulfilled') {
      return {
        sobject,
        metadata: result.value.data,
      };
    } else {
      let error = 'There was an error getting the fields for this object. ';
      if (isString(result.reason)) {
        error += result.reason;
      } else if (isString(result.reason?.message)) {
        error += result.reason.message;
      }
      return {
        sobject,
        error,
        metadata: null,
      };
    }
  });
}

export async function getChildRelationshipNames(
  selectedOrg: SalesforceOrgUi,
  metadataResults: SobjectFetchResult[],
): Promise<Record<string, Record<string, ChildRelationship>>> {
  try {
    // Get Parent SObject names from all relationship fields and remove duplicates
    const relatedSobjects = Array.from(
      new Set(
        metadataResults.flatMap(
          (item) =>
            item.metadata?.fields
              .filter((field) => field.type === 'reference' && field.referenceTo?.length === 1)
              .flatMap((field) => field.referenceTo || []) || [],
        ),
      ),
    );
    // Fetch all parent sobject metadata (hopefully from cache for many of them) and reduce into map for easy lookup
    const sobjectsWithChildRelationships = await getSobjectMetadata(selectedOrg, relatedSobjects).then((results) =>
      results.reduce((sobjectsWithChildRelationships: Record<string, Record<string, ChildRelationship>>, { metadata, sobject }) => {
        sobjectsWithChildRelationships[sobject] = (metadata?.childRelationships || []).reduce(
          (acc: Record<string, ChildRelationship>, childRelationship) => {
            acc[childRelationship.field] = childRelationship;
            return acc;
          },
          {},
        );
        return sobjectsWithChildRelationships;
      }, {}),
    );
    return sobjectsWithChildRelationships;
  } catch (ex) {
    logger.warn('Error getting child relationship names for sobject export', ex);
    logErrorToRollbar('Error getting child relationship names for sobject export', getErrorMessageAndStackObj(ex));
    return {};
  }
}

export async function getExtendedFieldDefinitionData(
  selectedOrg: SalesforceOrgUi,
  selectedSObjects: string[],
): Promise<Record<string, Record<string, FieldDefinitionRecord>>> {
  const allRecords: FieldDefinitionRecord[] = [];
  for (const sobjects of splitArrayToMaxSize(selectedSObjects, 10)) {
    try {
      const results = await queryAllUsingOffset<FieldDefinitionRecord>(selectedOrg, getFieldDefinitionQuery(sobjects), true);
      allRecords.push(...results.queryResults.records);
    } catch (ex) {
      logger.warn('Error getting extended field definition data for sobject export', ex);
      logErrorToRollbar('Error getting extended field definition data for sobject export', getErrorMessageAndStackObj(ex));
    }
  }

  return allRecords.reduce((acc: Record<string, Record<string, FieldDefinitionRecord>>, record) => {
    acc[record.EntityDefinition.QualifiedApiName] = acc[record.EntityDefinition.QualifiedApiName] || {};
    acc[record.EntityDefinition.QualifiedApiName][record.QualifiedApiName] = record;
    return acc;
  }, {});
}

export function prepareExport(
  sobjectMetadata: SobjectFetchResult[],
  sobjectsWithChildRelationships: Record<string, Record<string, ChildRelationship>>,
  extendedFieldDefinitionData: Record<string, Record<string, FieldDefinitionRecord>>,
  selectedAttributes: string[],
  options: ExportOptions,
): Record<string, any[]> {
  const errors: { sobject: string; error: string }[] = [];
  const sobjectAttributes: any[] = [];
  const rowsBySobject: Record<string, any[]> = {};
  const output: Record<string, any[]> = {};

  const selectedAttributesSet = new Set(selectedAttributes);
  // this ensures that the order is based on original list instead of order of selected attributes
  const selectedAttributeFields = getAttributes().filter((item) => selectedAttributesSet.has(item.name));

  // used only if sobjectAttributes is populated taken from first object to ensure that the order of items is consistent
  let sobjectAttributeKeys: string[];

  sobjectMetadata.forEach(({ sobject, error, metadata }) => {
    if (!error) {
      // Create field worksheet
      rowsBySobject[sobject] =
        metadata?.fields
          .filter((field) => (options.includesStandardFields ? true : field.custom))
          .flatMap((field: Field) => {
            const obj = { 'Object Name': sobject } as any;
            selectedAttributeFields.forEach(({ name, label, getterFn, childRelationshipGetterFn: relationshipGetterFn }) => {
              const _label = options.headerOption === 'label' ? label : name;
              const value = FIELD_DEFINITION_API_FIELDS.has(name as ExtendedFieldDefinition)
                ? extendedFieldDefinitionData?.[sobject]?.[field.name]?.[name as keyof FieldDefinitionRecord]
                : field[name as keyof Field];

              if (isFunction(getterFn)) {
                obj[_label] = getterFn(value);
              } else if (isFunction(relationshipGetterFn)) {
                obj[_label] = relationshipGetterFn(field, sobjectsWithChildRelationships);
              } else {
                obj[_label] = value;
              }
            });
            return obj;
          }) || [];

      // Create object worksheet if required
      if (options.includeObjectAttributes) {
        if (!sobjectAttributeKeys) {
          sobjectAttributeKeys = [
            'name',
            'label',
            ...Object.keys(metadata || {})
              .filter((key) => key !== 'name' && key !== 'label')
              .filter((key) => typeof metadata?.[key as keyof DescribeSObjectResult] !== 'object'),
          ];
        }
        sobjectAttributes.push(
          sobjectAttributeKeys.reduce((output: any, key) => {
            output[key] = metadata?.[key as keyof DescribeSObjectResult];
            return output;
          }, {}),
        );
      }
    } else {
      errors.push({ sobject, error });
    }
  });

  if (errors.length) {
    output['ERRORS'] = errors;
  }

  if (sobjectAttributes.length) {
    output['Object Metadata'] = sobjectAttributes;
  }

  if (options.worksheetLayout === 'combined') {
    output['Field Metadata'] = sobjectMetadata.reduce((output: any[], { sobject, error }) => {
      if (!error && rowsBySobject[sobject]) {
        rowsBySobject[sobject].forEach((row) => output.push(row));
      }
      return output;
    }, []);
  } else {
    // Worksheet per sobject
    sobjectMetadata.forEach(({ sobject, error }) => {
      if (!error && rowsBySobject[sobject]) {
        output[sobject.substring(0, 31)] = rowsBySobject[sobject];
      }
      return output;
    });
  }

  return output;
}

function getFieldDefinitionQuery(sobjects: string[]) {
  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('EntityDefinition.QualifiedApiName'),
      getField('QualifiedApiName'),
      ...Array.from(FIELD_DEFINITION_API_FIELDS).map((field) => getField(field)),
    ],
    sObject: 'FieldDefinition',
    where: {
      left: {
        field: 'EntityDefinition.QualifiedApiName',
        operator: 'IN',
        value: sobjects,
        literalType: 'STRING',
      },
    },
  });
  logger.info('getFieldDefinitionQuery()', { soql });
  return soql;
}

export function getAttributes(): SobjectExportField[] {
  return [
    {
      name: 'name',
      label: 'Name',
      description: 'Field name used in API calls, such as create(), delete(), and query().',
    },
    {
      name: 'label',
      label: 'Label',
      description: 'Text label that is displayed next to the field in the Salesforce user interface. This label can be localized.',
    },
    {
      name: 'type',
      label: 'Type',
      description: 'See FieldType for a list of allowable values.',
    },
    {
      name: 'aiPredictionField',
      label: 'AI Prediction Field',
      description: 'Indicates whether this field is used for AI prediction.',
    },
    {
      name: 'aggregatable',
      label: 'Aggregatable',
      description: 'Indicates whether this field can be aggregated in a GROUP BY query.',
    },
    {
      name: 'autoNumber',
      label: 'Auto-number',
      description:
        'Indicates whether this field is an autonumber field (true) or not (false). Analogous to a SQL IDENTITY type, autonumber fields are read only, non-createable text fields with a maximum length of 30 characters. Autonumber fields are read-only fields used to provide a unique ID that is independent of the internal object ID (such as a purchase order number or invoice number). Autonumber fields are configured entirely in the Salesforce user interface. The API provides access to this attribute so that client applications can determine whether a given field is an autonumber field.',
    },
    {
      name: 'byteLength',
      label: 'Byte Length',
      description: 'For variable-length fields (including binary fields), the maximum size of the field, in bytes.',
    },
    {
      name: 'BusinessOwnerId',
      label: 'Business Owner',
      description:
        'Indicates the person or group associated with this field. The business owner understands the importance of the field’s data to your company and might be responsible for determining the minimum security classification.',
    },
    {
      name: 'BusinessStatus',
      label: 'Business Status',
      description: 'Indicates whether the field is in use.',
    },
    {
      name: 'calculated',
      label: 'Calculated',
      description:
        'Indicates whether the field is a custom formula field (true) or not (false). Note that custom formula fields are always read-only.',
    },
    {
      name: 'caseSensitive',
      label: 'Case Sensitive',
      description: 'Indicates whether the field is case sensitive (true) or not (false).',
    },
    {
      name: 'compoundFieldName',
      label: 'Compound Field Name',
      description: '',
    },
    {
      name: 'cascadeDelete',
      label: 'Cascade Delete',
      description: 'Indicates if a parent record deletion will also delete records of this object.',
    },
    {
      name: 'calculatedFormula',
      label: 'Calculated Formula',
      description: 'Formula definition. Only populated if field type is Formula.',
    },
    {
      name: 'childRelationshipName',
      label: 'Child Relationship Name',
      description: 'Child relationship name(s) for lookup field.',
      childRelationshipGetterFn: (field: Field, sobjectsWithChildRelationships: Record<string, Record<string, ChildRelationship>>) => {
        const relatedSObjects = field.referenceTo || [];
        if (relatedSObjects.length === 0) {
          return '';
        }
        return relatedSObjects
          .map((relatedSObject) => {
            const childRelationship = sobjectsWithChildRelationships[relatedSObject]?.[field.name]?.relationshipName;
            if (childRelationship) {
              return childRelationship;
            }
            return null;
          })
          .filter(Boolean)
          .join(', ');
      },
    },
    {
      name: 'ComplianceGroup',
      label: 'Compliance Group',
      description: 'The compliance acts, definitions, or regulations related to the field’s data.',
    },
    {
      name: 'controllerName',
      label: 'Controller Name',
      description:
        'The name of the field that controls the values of this picklist. It only applies if type is picklist or multipicklist and dependentPicklist is true. The mapping of controlling field to dependent field is stored in the validFor attribute of each PicklistEntry for this picklist.',
    },
    {
      name: 'createable',
      label: 'Createable',
      description:
        'Indicates whether the field can be created (true) or not (false). If true, then this field value can be set in a create() call.',
    },
    {
      name: 'custom',
      label: 'Custom',
      description: 'Indicates whether the field is a custom field (true) or not (false).',
    },
    {
      name: 'dataTranslationEnabled',
      label: 'Data Translation Enabled',
      description:
        'Indicates whether data translation is enabled for the field (true) or not (false). Available in API version 49.0 and later.',
    },
    {
      name: 'defaultedOnCreate',
      label: 'Defaulted On Create',
      description:
        'Indicates whether this field is defaulted when created (true) or not (false). If true, then Salesforce implicitly assigns a value for this field when the object is created, even if a value for this field is not passed in on the create() call. For example, in the Opportunity object, the Probability field has this attribute because its value is derived from the Stage field. Similarly, the Owner has this attribute on most objects because its value is derived from the current user (if the Owner field is not specified).',
    },
    {
      name: 'defaultValue',
      label: 'Default Value',
      description: 'The default value specified for this field.',
    },
    {
      name: 'defaultValueFormula',
      label: 'Default Value Formula',
      description:
        'The default value specified for this field if the formula is not used. If no value has been specified, this field is not returned.',
    },
    {
      name: 'dependentPicklist',
      label: 'Dependent Picklist',
      description:
        'Indicates whether a picklist is a dependent picklist (true) where available values depend on the chosen values from a controlling field, or not (false). See About Dependent Picklists.',
    },
    {
      name: 'deprecatedAndHidden',
      label: 'Deprecated And Hidden',
      description: 'Reserved for future use.',
    },
    {
      name: 'digits',
      label: 'Digits',
      description:
        'For fields of type integer. Maximum number of digits. The API returns an error if an integer value exceeds the number of digits.',
    },
    {
      name: 'displayLocationInDecimal',
      label: 'Display Location In Decimal',
      description:
        'Indicates how the geolocation values of a Location custom field appears in the user interface. If true, the geolocation values appear in decimal notation. If false, the geolocation values appear as degrees, minutes, and seconds.',
    },
    {
      name: 'encrypted',
      label: 'Encrypted',
      description:
        "Note\nThis page is about Shield Platform Encryption, not Classic Encryption. What's the difference?\nIndicates whether this field is encrypted. This value only appears in the results of a describeSObjects() call when it is true; otherwise, it is omitted from the results. This field is available in API version 31.0 and later.",
    },
    {
      name: 'externalId',
      label: 'External Id',
      description: 'Indicates if this field is an identifier in an external system.',
    },
    {
      name: 'extraTypeInfo',
      label: 'Extra Type Info',
      description:
        'If the field is a textarea field type, indicates if the text area is plain text (plaintextarea) or rich text (richtextarea).\nIf the field is a url field type, if this value is imageurl, the URL references an image file. Available on standard fields on standard objects only, for example, Account.photoUrl, Contact.photoUrl, and so on.\nIf the field is a reference field type, indicates the type of external object relationship. Available on external objects only.\nnull—lookup relationship\nexternallookup—external lookup relationship\nindirectlookup—indirect lookup relationship',
    },
    {
      name: 'filterable',
      label: 'Filterable',
      description:
        'Indicates whether the field is filterable (true) or not (false). If true, then this field can be specified in the WHERE clause of a query string in a query() call.',
    },
    {
      name: 'filteredLookupInfo',
      label: 'Filtered Lookup Info',
      description:
        'If the field is a reference field type with a lookup filter, filteredLookupInfo contains the lookup filter information for the field. If there is no lookup filter, or the filter is inactive, this field is null.\nThis field is available in API version 31.0 and later.',
    },
    {
      name: 'formula',
      label: 'Formula',
      description: 'The formula specified for this field. If no formula is specified for this field, it is not returned.',
    },
    {
      name: 'formulaTreatNullNumberAsZero',
      label: 'Formula - Treat Null Number As Zero',
      description: 'Indicates if a formula with no value is considered a blank or a zero. Only applies to number formula fields.',
    },
    {
      name: 'groupable',
      label: 'Groupable',
      description:
        'Indicates whether the field can be included in the GROUP BY clause of a SOQL query (true) or not (false). See GROUP BY in the Salesforce SOQL and SOSL Reference Guide. Available in API version 18.0 and later.',
    },
    {
      name: 'highScaleNumber',
      label: 'High Scale Number',
      description:
        'Indicates whether the field stores numbers to 8 decimal places regardless of what’s specified in the field details (true) or not (false). Used to handle currencies for products that cost fractions of a cent, in large quantities. If high-scale unit pricing isn’t enabled in your organization, this field isn’t returned. Available in API version 33.0 and later.',
    },
    {
      name: 'htmlFormatted',
      label: 'Html Formatted',
      description:
        'Indicates whether a field such as a hyperlink custom formula field has been formatted for HTML and should be encoded for display in HTML (true) or not (false). Also indicates whether a field is a custom formula field that has an IMAGE text function.',
    },
    {
      name: 'idLookup',
      label: 'Id Lookup',
      description: 'Indicates whether the field can be used to specify a record in an upsert() call (true) or not (false).',
    },
    {
      name: 'inlineHelpText',
      label: 'Inline Help Text',
      description:
        'The text that displays in the field-level help hover text for this field.\n\nNote\nThis property is not returned unless at least one field on the object contains a value. When at least one field has field-level help, all fields on the object list the property with either the field-level help value or null for fields that have blank field-level help.',
    },
    {
      name: 'IsFieldHistoryTracked',
      label: 'Is Field History Tracked',
      description: 'If true, the field’s history can be tracked.',
    },
    {
      name: 'IsFlsEnabled',
      label: 'Is Field Level Security Enabled',
      description: 'If true, you can set field-level security on this field.',
    },
    {
      name: 'length',
      label: 'Length',
      description:
        'Returns the maximum size of the field in Unicode characters (not bytes) or 255, whichever is less. The maximum value returned by the getLength() property is 255. Available in API version 49.0 and later.',
    },
    {
      name: 'precision',
      label: 'Precision',
      description:
        'For fields of type double. Maximum number of digits that can be stored, including all numbers to the left and to the right of the decimal point (but excluding the decimal point character).',
    },
    {
      name: 'mask',
      label: 'Mask',
      description: 'Reserved for future use.',
    },
    {
      name: 'maskType',
      label: 'Mask Type',
      description: 'Reserved for future use.',
    },
    {
      name: 'nameField',
      label: 'Name Field',
      description:
        'Indicates whether this field is a name field (true) or not (false). Used to identify the name field for standard objects (such as AccountName for an Account object) and custom objects. Limited to one per object, except where FirstName and LastName fields are used (such as in the Contact object).\nIf a compound name is present, for example the Name field on a person account, nameField is set to true for that record. If no compound name is present, FirstName and LastName have this field set to true.',
    },
    {
      name: 'namePointing',
      label: 'Name Pointing',
      description:
        "Indicates whether the field's value is the Name of the parent of this object (true) or not (false). Used for objects whose parents may be more than one type of object, for example a task may have an account or a contact as a parent.",
    },
    {
      name: 'nillable',
      label: 'Nillable',
      description:
        'Indicates whether the field is nillable (true) or not (false). A nillable field can have empty content. A non-nillable field must have a value in order for the object to be created or saved.',
    },
    {
      name: 'permissionable',
      label: 'Permissionable',
      description: 'Indicates whether FieldPermissions can be specified for the field (true) or not (false).',
    },
    {
      name: 'picklistValues',
      label: 'Picklist Values',
      description: 'Provides the list of valid values for the picklist. Specified only if restrictedPicklist is true.',
      getterFn: (value: any) => {
        if (!Array.isArray(value)) {
          return value;
        }
        return value
          .map((item: { active: boolean; defaultValue: boolean; label: string; validFor: string; value: string }) => {
            let output = item.value;
            if (item.value !== item.label) {
              return (output += ` (${item.label})`);
            }
            if (!item.active) {
              return (output += ` (INACTIVE)`);
            }
            return output;
          })
          .join('\n');
      },
    },
    {
      name: 'polymorphicForeignKey',
      label: 'Polymorphic Foreign Key',
      description: 'Indicates whether the foreign key includes multiple entity types (true) or not (false).',
    },
    {
      name: 'queryByDistance',
      label: 'Query By Distance',
      description: '',
    },
    {
      name: 'relationshipName',
      label: 'Relationship Name',
      description: 'The name of the relationship, if this is a master-detail relationship field.',
    },
    {
      name: 'relationshipOrder',
      label: 'Relationship Order',
      description:
        'The type of relationship for a master-detail relationship field. Valid values are:\n0 if the field is the primary relationship\n1 if the field is the secondary relationship',
    },
    {
      name: 'referenceTargetField',
      label: 'Reference Target Field',
      description:
        "Applies only to indirect lookup relationships on external objects. Name of the custom field on the parent standard or custom object whose values are matched against the values of the child external object's indirect lookup relationship field. This matching is done to determine which records are related to each other. This field is available in API version 32.0 and later.",
    },
    {
      name: 'referenceTo',
      label: 'ReferenceTo',
      description: 'For fields that refer to other objects, this array indicates the object types of the referenced objects.',
      getterFn: (value) => {
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return value;
      },
    },
    {
      name: 'restrictedPicklist',
      label: 'Restricted Picklist',
      description: 'Indicates whether the field is a restricted picklist (true) or not (false).',
    },
    {
      name: 'restrictedDelete',
      label: 'Restrict Delete',
      description: 'Indicates if a related record can be deleted if the lookup is populated.',
    },
    {
      name: 'scale',
      label: 'Scale',
      description:
        'For fields of type double. Number of digits to the right of the decimal point. The API silently truncates any extra digits to the right of the decimal point, but it returns a fault response if the number has too many digits to the left of the decimal point.',
    },
    {
      name: 'searchPrefilterable',
      label: 'Search Pre-filterable',
      description:
        'Indicates whether a foreign key can be included in prefiltering (true) or not (false) when used in a SOSL WHERE clause. Prefiltering means to filter by a specific field value before executing the full search query. Available in API version 40.0 and later.',
    },
    {
      name: 'SecurityClassification',
      label: 'Security Classification',
      description: 'Indicates the sensitivity of the data contained in this field.',
    },

    {
      name: 'soapType',
      label: 'Soap Type',
      description: 'See SOAPType for a list of allowable values.',
    },
    {
      name: 'sortable',
      label: 'Sortable',
      description: 'Indicates whether a query can sort on this field (true) or not (false).',
    },
    {
      name: 'typeLabel',
      label: 'Type Label',
      description: '',
    },
    {
      name: 'unique',
      label: 'Unique',
      description: 'Indicates whether the value must be unique true) or not false).',
    },
    {
      name: 'updateable',
      label: 'Updateable',
      description:
        'Indicates one of the following:\nWhether the field is updateable, (true) or not (false).If true, then this field value can be set in an update() call.\nIf the field is in a master-detail relationship on a custom object, indicates whether the child records can be reparented to different parent records (true), false otherwise.',
    },
    {
      name: 'writeRequiresMasterRead',
      label: 'Write Requires Master Read',
      description:
        'This field only applies to master-detail relationships. Indicates whether a user requires read sharing access (true) or write sharing access (false) to the parent record to insert, update, and delete a child record. In both cases, a user also needs Create, Edit, and Delete object permissions for the child object.',
    },
  ];
}

export function getMetadataAttributes(): SobjectExportField[] {
  return [
    {
      name: 'name',
      label: 'Full Name',
      description: 'The unique identifier for the field. This must be specified when creating, updating, or deleting.',
    },
    {
      name: 'label',
      label: 'Label',
      description: 'Text label that is displayed next to the field in the Salesforce user interface. This label can be localized.',
    },
    {
      name: 'type',
      label: 'Type',
      description: 'The field type for the field.',
    },
    {
      name: 'inlineHelpText',
      label: 'Inline Help Text',
      description: 'Represents the content of field-level help.',
    },
    {
      name: 'description',
      label: 'Description',
      description: 'Description of the field.',
    },
    {
      name: 'length',
      label: 'Length',
      description: 'Length of the field.',
    },
    {
      name: 'precision',
      label: 'Precision',
      description: 'The precision for number values. Precision is the number of digits in a number. For example, the number 256.99 has a precision value of 5.',
    },
    {
      name: 'scale',
      label: 'Scale',
      description: 'The scale for the field. Scale is the number of digits to the right of the decimal point in a number. For example, the number 256.99 has a scale of 2.',
    },
    {
      name: 'required',
      label: 'Required',
      description: 'Indicates whether the field requires a value on creation (true) or not (false).',
    },
    {
      name: 'unique',
      label: 'Unique',
      description: 'Indicates whether the field is unique (true) or not (false).',
    },
    {
      name: 'externalId',
      label: 'External ID',
      description: 'Indicates whether the field is an external ID field (true) or not (false). This property is returned only if the custom field data type is AutoNumber, Email, Number, or Text.',
    },
    {
      name: 'defaultValue',
      label: 'Default Value',
      description: 'If specified, represents the default value of the field.',
    },
    {
      name: 'referenceTo',
      label: 'Reference To',
      description: 'If specified, indicates a reference this field has to another object.',
      getterFn: (value) => {
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return value;
      },
    },
    {
      name: 'deleteConstraint',
      label: 'Delete Constraint',
      description: 'Provides deletion options for lookup relationships. Valid values are: Cascade (deletes the lookup record as well as associated lookup fields), Restrict (prevents the record from being deleted if it\'s in a lookup relationship), SetNull (if the lookup record is deleted, the lookup field is cleared).',
    },
    {
      name: 'relationshipName',
      label: 'Relationship Name',
      description: 'Label for the relationship.',
    },
    {
      name: 'formula',
      label: 'Formula',
      description: 'If specified, represents a formula on the field.',
    },
    {
      name: 'formulaTreatBlanksAs',
      label: 'Formula Treat Blanks As',
      description: 'Indicates how to treat blanks in a formula. Valid values are: BlankAsBlank and BlankAsZero.',
    },
    {
      name: 'writeRequiresMasterRead',
      label: 'Write Requires Master Read',
      description: 'Sets the minimum sharing access level required on the primary record to create, edit, or delete child records. This field applies only to master-detail or junction object custom field types. True allows users with Read access to the primary record permission to create, edit, or delete child records. False allows users with Read/Write access to the primary record permission to create, edit, or delete child records.',
    },
    {
      name: 'reparentableMasterDetail',
      label: 'Reparentable Master Detail',
      description: 'Indicates whether the child records in a master-detail relationship on a custom object can be reparented to different parent records. The default value is false.',
    },
    {
      name: 'visibleLines',
      label: 'Visible Lines',
      description: 'Indicates the number of lines displayed for the field.',
    },
    {
      name: 'displayFormat',
      label: 'Display Format',
      description: 'The display format.',
    },
    {
      name: 'startingNumber',
      label: 'Starting Number',
      description: 'If specified, indicates the starting number for the field. When you create records, Starting Number\'s value increments to store the number that will be assigned to the next auto-number field created.',
    },
    {
      name: 'populateExistingRows',
      label: 'Populate Existing Rows',
      description: 'Indicates whether existing rows are going to be populated (true) or not (false).',
    },
    {
      name: 'displayLocationInDecimal',
      label: 'Display Location In Decimal',
      description: 'Indicates how the geolocation values of a custom Location field appear in the user interface. If true, the geolocation values appear in decimal notation. If false, the geolocation values appear as degrees, minutes, and seconds.',
    },
    {
      name: 'maskChar',
      label: 'Mask Character',
      description: 'For encrypted fields, specifies the character to be used as a mask. Valid values are: asterisk, X.',
    },
    {
      name: 'maskType',
      label: 'Mask Type',
      description: 'For encrypted text fields, specifies the format of the masked and unmasked characters in the field. Valid values are: all (all characters hidden), creditCard (first 12 characters hidden, last four display), lastFour (all characters hidden but last four display), nino (all characters hidden with automatic spaces after each pair), sin (all characters hidden but last four display), ssn (first five characters hidden, last four display).',
    },
    {
      name: 'valueSet',
      label: 'Value Set',
      description: 'Represents the set of values that make up a picklist on a custom field. If this custom field is a picklist that uses a global value set, valueSet is the name of the global value set whose values this picklist inherits.',
    },
  ];
}
