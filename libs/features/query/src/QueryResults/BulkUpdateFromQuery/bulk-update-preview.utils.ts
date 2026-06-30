import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { getRecordIdFromAttributes } from '@jetstream/shared/utils';
import { SalesforceRecord } from '@jetstream/types';
import { MetadataRowConfiguration, prepareRecords } from '@jetstream/ui-core';
import isNil from 'lodash/isNil';

export interface ProposedFieldChange {
  field: string;
  /** Original value on the record (normalized so `undefined` becomes `null`) */
  currentValue: unknown;
  /** Value that will be written. Equals `currentValue` when this field is not changing for this record. */
  newValue: unknown;
  /** True when the cell value actually changes (used to highlight the cell in the preview) */
  willChange: boolean;
}

export interface ProposedChangeRecord {
  recordId: string;
  changes: ProposedFieldChange[];
}

export interface ProposedChangesResult {
  /** Configured fields, de-duplicated and in configuration order */
  fields: string[];
  /** Only records that will be updated (at least one configured field meets its criteria) */
  records: ProposedChangeRecord[];
  impactedRecordIds: string[];
}

/**
 * Re-implements the criteria gate that {@link prepareRecords} applies, so we can tell whether a record
 * is "touched" independently of the value. This matters for the `update` ("update without changes")
 * option, where the value does not change but the record is still submitted. `custom` criteria is not
 * available in the query-results flow, so it is treated as `all`.
 */
function isCriteriaMet(record: SalesforceRecord, field: string, criteria: MetadataRowConfiguration['transformationOptions']['criteria']) {
  if (criteria === 'onlyIfBlank') {
    return isNil(record[field]);
  }
  if (criteria === 'onlyIfNotBlank') {
    return !isNil(record[field]);
  }
  return true;
}

/**
 * Computes the proposed changes for a set of already-fetched records using the exact same transform
 * ({@link prepareRecords}) that the commit will use, guaranteeing the preview matches what is saved.
 *
 * Returns only the impacted records (those that will be updated). For each impacted record, every
 * configured field is represented, with `willChange` flagging the cells whose value actually changes.
 */
export function buildProposedChanges(records: SalesforceRecord[], configuration: MetadataRowConfiguration[]): ProposedChangesResult {
  const fieldConfigs = configuration.filter((config) => config.selectedField);
  const fields = Array.from(new Set(fieldConfigs.map((config) => config.selectedField as string)));
  const preparedRecords = prepareRecords(records, configuration);

  const impactedRecords: ProposedChangeRecord[] = [];

  records.forEach((record, index) => {
    const preparedRecord = preparedRecords[index];
    const changeByField = new Map<string, ProposedFieldChange>();
    const touchedFields = new Set<string>();

    fieldConfigs.forEach(({ selectedField, transformationOptions }) => {
      const field = selectedField as string;
      const currentValue = record[field] ?? null;
      const criteriaMet = isCriteriaMet(record, field, transformationOptions.criteria);

      if (!criteriaMet) {
        // Mirror prepareRecords' last-config-wins semantics: a later config whose criteria is not met
        // resets the field to unchanged and un-touches it (prepareRecords would null it out), so the
        // preview/impact detection matches what is actually committed.
        changeByField.set(field, { field, currentValue, newValue: currentValue, willChange: false });
        touchedFields.delete(field);
        return;
      }

      touchedFields.add(field);
      if (transformationOptions.option === 'update') {
        // The record is touched but the value does not change
        changeByField.set(field, { field, currentValue, newValue: currentValue, willChange: false });
      } else {
        const newValue = preparedRecord[field];
        changeByField.set(field, { field, currentValue, newValue, willChange: newValue !== currentValue });
      }
    });

    if (touchedFields.size > 0) {
      const recordId = record.Id ?? getRecordIdFromAttributes(record);
      impactedRecords.push({
        recordId,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        changes: fields.map((field) => changeByField.get(field)!),
      });
    }
  });

  return {
    fields,
    records: impactedRecords,
    impactedRecordIds: impactedRecords.map((record) => record.recordId),
  };
}

/** Formats a raw record value for display in the preview grid. */
export function formatProposedValue(value: unknown): string {
  if (value === SFDC_BULK_API_NULL_VALUE) {
    return '(cleared)';
  }
  if (isNil(value) || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
