import { describeSObject } from '@jetstream/shared/data';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { ApiResponse, DescribeSObjectResult, SalesforceOrgUi } from '@jetstream/types';
import isFunction from 'lodash/isFunction';
import isString from 'lodash/isString';
import { ExportOptions, SobjectExportField, SobjectFetchResult } from './sobject-export-types';

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

export function prepareExport(
  sobjectMetadata: SobjectFetchResult[],
  selectedAttributes: string[],
  options: ExportOptions
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
          .flatMap((field: any) => {
            const obj = { 'Object Name': sobject } as any;
            selectedAttributeFields.forEach(({ name, label, getterFn }) => {
              const _label = options.headerOption === 'label' ? label : name;
              // TODO: transform as required

              if (isFunction(getterFn)) {
                obj[_label] = getterFn(field[name]);
              } else {
                obj[_label] = field[name];
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
          }, {})
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
