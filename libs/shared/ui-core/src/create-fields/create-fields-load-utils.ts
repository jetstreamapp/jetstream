import { Field } from '@jetstream/types';
import { CustomFieldMetadata, FieldValues, SalesforceFieldType } from './create-fields-types';
import { getInitialValues } from './create-fields-utils';

/**
 * Maps a Salesforce describe Field type to the SalesforceFieldType used by the create fields editor.
 * Returns null for field types that are not supported by the create fields editor.
 */
export function mapDescribeFieldTypeToSalesforceFieldType(field: Field): SalesforceFieldType | null {
  if (field.autoNumber) {
    return 'AutoNumber';
  }
  if (field.calculated && field.calculatedFormula) {
    return 'Formula';
  }

  switch (field.type) {
    case 'string':
      return 'Text';
    case 'boolean':
      return 'Checkbox';
    case 'currency':
      return 'Currency';
    case 'date':
      return 'Date';
    case 'datetime':
      return 'DateTime';
    case 'time':
      return 'Time';
    case 'int':
    case 'double':
      return 'Number';
    case 'percent':
      return 'Percent';
    case 'phone':
      return 'Phone';
    case 'email':
      return 'Email';
    case 'url':
      return 'Url';
    case 'picklist':
      return 'Picklist';
    case 'multipicklist':
      return 'MultiselectPicklist';
    case 'reference': {
      // Master-Detail fields have a non-null relationshipOrder
      if (field.relationshipOrder != null) {
        return 'MasterDetail';
      }
      return 'Lookup';
    }
    case 'textarea': {
      if (field.extraTypeInfo === 'richtextarea') {
        return 'Html';
      }
      if (field.length > 255) {
        return 'LongTextArea';
      }
      return 'TextArea';
    }
    case 'address':
      return 'Address';
    case 'encryptedstring':
      return 'Text';
    default:
      return null;
  }
}

/**
 * Derives the formula secondary type (the return type) from the describe field type.
 */
function getFormulaSecondaryType(field: Field): SalesforceFieldType {
  switch (field.type) {
    case 'boolean':
      return 'Checkbox';
    case 'currency':
      return 'Currency';
    case 'date':
      return 'Date';
    case 'datetime':
      return 'DateTime';
    case 'time':
      return 'Time';
    case 'double':
    case 'int':
      return 'Number';
    case 'percent':
      return 'Percent';
    default:
      return 'Text';
  }
}

/**
 * Extracts the DeveloperName from a field API name.
 * Handles namespaced fields: "ns__FieldName__c" -> "FieldName"
 * Non-namespaced: "FieldName__c" -> "FieldName"
 */
export function getDeveloperNameFromFieldApiName(fieldName: string): string {
  const withoutSuffix = fieldName.endsWith('__c') ? fieldName.slice(0, -3) : fieldName;
  // If there's a namespace prefix (e.g., "ns__FieldName"), extract just the developer name
  const parts = withoutSuffix.split('__');
  if (parts.length >= 2) {
    return parts[parts.length - 1];
  }
  return withoutSuffix;
}

/**
 * Maps a Salesforce describe Field (plus optional CustomField Metadata) to a FieldValues row
 * suitable for the create fields editor.
 */
export function mapFieldToFieldValues(field: Field, customFieldMetadata: CustomFieldMetadata | undefined, key: number): FieldValues | null {
  const fieldType = mapDescribeFieldTypeToSalesforceFieldType(field);
  if (!fieldType) {
    return null;
  }

  const fieldValues = getInitialValues(key);

  // Type
  setFieldValue(fieldValues, 'type', fieldType);

  // Label
  setFieldValue(fieldValues, 'label', field.label);

  // fullName - use developer name without namespace prefix or __c suffix
  // prepareFieldPayload re-adds the namespace and __c on deploy
  setFieldValue(fieldValues, 'fullName', getDeveloperNameFromFieldApiName(field.name));

  // Description - only from CustomField Metadata
  if (customFieldMetadata?.description) {
    setFieldValue(fieldValues, 'description', customFieldMetadata.description);
  }

  // Inline Help Text - prefer CustomField Metadata over describe
  if (customFieldMetadata?.inlineHelpText) {
    setFieldValue(fieldValues, 'inlineHelpText', customFieldMetadata.inlineHelpText);
  } else if (field.inlineHelpText) {
    setFieldValue(fieldValues, 'inlineHelpText', field.inlineHelpText);
  }

  // Default value
  if (fieldType === 'Checkbox') {
    setFieldValue(fieldValues, 'defaultValue', field.defaultValue === true || field.defaultValue === 'true');
  } else if (field.defaultValue != null) {
    setFieldValue(fieldValues, 'defaultValue', String(field.defaultValue));
  }

  // Length
  if (field.length) {
    setFieldValue(fieldValues, 'length', String(field.length));
  }

  // Precision and Scale - the UI stores precision as "digits to the left of decimal"
  // while Salesforce returns precision as total digits including scale
  if (field.precision != null && field.scale != null) {
    setFieldValue(fieldValues, 'precision', String(field.precision - field.scale));
    setFieldValue(fieldValues, 'scale', String(field.scale));
  }

  // Required (inverse of nillable)
  setFieldValue(fieldValues, 'required', !field.nillable);

  // Unique
  setFieldValue(fieldValues, 'unique', field.unique);

  // External ID
  setFieldValue(fieldValues, 'externalId', field.externalId);

  // Reference fields (Lookup/MasterDetail)
  if (field.referenceTo?.length) {
    setFieldValue(fieldValues, 'referenceTo', field.referenceTo[0]);
  }
  if (field.relationshipName) {
    // Describe returns the relationship name with __r suffix, but the editor expects it without
    const relationshipName = field.relationshipName.endsWith('__r') ? field.relationshipName.slice(0, -3) : field.relationshipName;
    setFieldValue(fieldValues, 'relationshipName', relationshipName);
  }

  // Delete constraint for Lookup
  if (fieldType === 'Lookup') {
    if (field.cascadeDelete) {
      setFieldValue(fieldValues, 'deleteConstraint', 'Cascade');
    } else if (field.restrictedDelete) {
      setFieldValue(fieldValues, 'deleteConstraint', 'Restrict');
    } else {
      setFieldValue(fieldValues, 'deleteConstraint', 'SetNull');
    }
  }

  // MasterDetail specific
  if (fieldType === 'MasterDetail') {
    if (field.writeRequiresMasterRead != null) {
      setFieldValue(fieldValues, 'writeRequiresMasterRead', String(field.writeRequiresMasterRead));
    }
    if (customFieldMetadata?.reparentableMasterDetail != null) {
      setFieldValue(fieldValues, 'reparentableMasterDetail', customFieldMetadata.reparentableMasterDetail);
    }
  }

  // Formula
  if (fieldType === 'Formula') {
    if (field.calculatedFormula) {
      setFieldValue(fieldValues, 'formula', field.calculatedFormula);
    }
    setFieldValue(fieldValues, 'secondaryType', getFormulaSecondaryType(field));

    // formulaTreatBlanksAs - prefer CustomField Metadata
    // Tooling API returns 'BlankAsZero' or 'BlankAsBlank', UI uses 'BlankAsZero' or 'Blanks'
    if (customFieldMetadata?.formulaTreatBlanksAs) {
      setFieldValue(
        fieldValues,
        'formulaTreatBlanksAs',
        customFieldMetadata.formulaTreatBlanksAs === 'BlankAsZero' ? 'BlankAsZero' : 'Blanks',
      );
    } else if (field.formulaTreatNullNumberAsZero) {
      setFieldValue(fieldValues, 'formulaTreatBlanksAs', 'BlankAsZero');
    } else {
      setFieldValue(fieldValues, 'formulaTreatBlanksAs', 'Blanks');
    }
  }

  // AutoNumber
  if (fieldType === 'AutoNumber' && customFieldMetadata) {
    if (customFieldMetadata.displayFormat) {
      setFieldValue(fieldValues, 'displayFormat', customFieldMetadata.displayFormat);
    }
    if (customFieldMetadata.startingNumber != null) {
      setFieldValue(fieldValues, 'startingNumber', String(customFieldMetadata.startingNumber));
    }
  }

  // Picklist / MultiselectPicklist
  if (fieldType === 'Picklist' || fieldType === 'MultiselectPicklist') {
    handlePicklistMapping(fieldValues, field, customFieldMetadata);
  }

  // Visible lines (LongTextArea, Html, MultiselectPicklist)
  if (customFieldMetadata?.visibleLines != null) {
    setFieldValue(fieldValues, 'visibleLines', String(customFieldMetadata.visibleLines));
  }

  // Mark all fields as touched (same pattern as CSV import)
  markAllFieldsTouched(fieldValues);

  return fieldValues;
}

/**
 * Helper to set a FieldValueState on a FieldValues row.
 */
function setFieldValue(fieldValues: FieldValues, field: keyof FieldValues, value: string | boolean | number): void {
  if (field === '_key' || field === '_allValid' || field === '_picklistGlobalValueSet') {
    return;
  }
  (fieldValues as any)[field] = {
    value,
    touched: true,
    isValid: true,
    errorMessage: null,
  };
}

/**
 * Mark all FieldValueState fields as touched so validation runs on import.
 */
function markAllFieldsTouched(fieldValues: FieldValues): void {
  for (const key of Object.keys(fieldValues)) {
    if (key.startsWith('_')) {
      continue;
    }
    const fieldState = (fieldValues as any)[key];
    if (fieldState && typeof fieldState === 'object' && 'touched' in fieldState) {
      fieldState.touched = true;
    }
  }
}

/**
 * Handles picklist value mapping, detecting global value sets vs inline values.
 */
function handlePicklistMapping(fieldValues: FieldValues, field: Field, customFieldMetadata: CustomFieldMetadata | undefined): void {
  // Check if this is a global value set picklist (only detectable from CustomField Metadata)
  if (customFieldMetadata?.valueSet?.valueSetName) {
    fieldValues._picklistGlobalValueSet = true;
    setFieldValue(fieldValues, 'globalValueSet', customFieldMetadata.valueSet.valueSetName);
    // Global value sets must be restricted, the UI disables this field and forces it to be true in normal operation
    setFieldValue(fieldValues, 'restricted', true);
    setFieldValue(fieldValues, 'valueSet', '');
  } else if (customFieldMetadata?.valueSet?.valueSetDefinition?.value?.length) {
    // Inline values from CustomField Metadata
    // Salesforce returns `valueName` (not `fullName`) and `isActive` (null = active, false = inactive)
    fieldValues._picklistGlobalValueSet = false;
    const activeValues = customFieldMetadata.valueSet.valueSetDefinition.value.filter((v) => v.isActive !== false);
    setFieldValue(fieldValues, 'valueSet', activeValues.map((v) => v.valueName || v.fullName || v.label).join('\n'));
    setFieldValue(fieldValues, 'restricted', customFieldMetadata.valueSet.restricted ?? field.restrictedPicklist);
    setFieldValue(fieldValues, 'firstAsDefault', activeValues.length > 0 && activeValues[0].default);
    setFieldValue(fieldValues, 'globalValueSet', '');
  } else if (field.picklistValues?.length) {
    // Fallback to describe picklist values
    fieldValues._picklistGlobalValueSet = false;
    const activeValues = field.picklistValues.filter((pv) => pv.active);
    setFieldValue(fieldValues, 'valueSet', activeValues.map((pv) => pv.value || pv.label).join('\n'));
    setFieldValue(fieldValues, 'restricted', field.restrictedPicklist);
    setFieldValue(fieldValues, 'firstAsDefault', Boolean(activeValues[0]?.defaultValue));
    setFieldValue(fieldValues, 'globalValueSet', '');
  }
}

/**
 * Builds individual SOQL queries for fetching CustomField Metadata from the Tooling API.
 * The Tooling API requires Metadata/FullName queries to return no more than one row,
 * so each field must be queried individually.
 */
export function buildCustomFieldQuery(sobject: string, developerName: string): string {
  return `SELECT Id, DeveloperName, FullName, Metadata, NamespacePrefix FROM CustomField WHERE EntityDefinition.QualifiedApiName = '${sobject}' AND DeveloperName = '${developerName}' LIMIT 1`;
}

/**
 * Row type for the field selection table in the modal.
 */
export interface ExistingFieldRow {
  /** Unique key for the data table row */
  key: string;
  /** Field label */
  label: string;
  /** Full API name (e.g., "My_Field__c") */
  apiName: string;
  /** Mapped field type for display */
  fieldType: SalesforceFieldType;
  /** Inline help text for preview */
  helpText: string;
  /** The original describe Field */
  field: Field;
}

/**
 * Returns the namespace prefix from a custom field API name, or null if non-namespaced.
 * e.g. "ns__MyField__c" => "ns", "MyField__c" => null
 */
function getFieldNamespacePrefix(fieldName: string): string | null {
  const match = /^([A-Za-z0-9]+)__.+__c$/.exec(fieldName);
  return match ? match[1] : null;
}

/**
 * Converts describe fields to rows for the selection table.
 * Filters to custom fields only and excludes compound sub-fields, encrypted fields,
 * and managed-package fields from a different namespace than the current org.
 */
export function getExistingFieldRows(fields: Field[], orgNamespacePrefix?: string | null): ExistingFieldRow[] {
  return fields
    .filter((field) => {
      if (!field.custom || field.compoundFieldName || field.type === 'encryptedstring' || !field.name.endsWith('__c')) {
        return false;
      }
      // Exclude managed-package fields that don't belong to the current org's namespace
      const fieldNamespace = getFieldNamespacePrefix(field.name);
      if (fieldNamespace !== null && fieldNamespace !== orgNamespacePrefix) {
        return false;
      }
      // Exclude fields with types not supported by the create fields editor
      return mapDescribeFieldTypeToSalesforceFieldType(field) !== null;
    })
    .map((field): ExistingFieldRow => {
      // Safe to assert non-null since we filtered above
      const fieldType = mapDescribeFieldTypeToSalesforceFieldType(field) as SalesforceFieldType;
      return {
        key: field.name,
        label: field.label,
        apiName: field.name,
        fieldType,
        helpText: field.inlineHelpText || '',
        field,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
