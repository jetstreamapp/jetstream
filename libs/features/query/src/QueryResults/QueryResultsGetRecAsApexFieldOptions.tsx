import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Field } from '@jetstream/types';
import { Checkbox, Grid } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { RecordToApexOptionsInitialOptions } from '../utils/query-apex-utils';

export interface QueryResultsGetRecAsApexFieldOptionsProps {
  fieldMetadata: Field[];
  onFields: (fields: string[]) => void;
  onOptionsChange: (partialOptions: Partial<RecordToApexOptionsInitialOptions>) => void;
}

const SYS_FIELDS = new Set([
  'CreatedById',
  'CreatedDate',
  'OwnerId',
  'LastActivityDate',
  'LastModifiedById',
  'LastModifiedDate',
  'LastReferencedDate',
  'LastViewedDate',
  'SystemModstamp',
]);

export const QueryResultsGetRecAsApexFieldOptions: FunctionComponent<QueryResultsGetRecAsApexFieldOptionsProps> = ({
  fieldMetadata,
  onFields,
  onOptionsChange,
}) => {
  const [nulls, setNulls] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [system, setSystem] = useState(false);
  const [defaultOnCreate, setDefaultOnCreate] = useState(true);
  const [booleanIfFalse, setBooleanIfFalse] = useState(false);
  const [fields, setFields] = useState<string[]>([]);

  useEffect(() => {
    setFields(
      fieldMetadata
        .filter((field) => {
          if (!readOnly && !field.createable) {
            return false;
          }
          if (!system && SYS_FIELDS.has(field.name)) {
            return false;
          }
          if (!defaultOnCreate && field.defaultedOnCreate) {
            return false;
          }
          return true;
        })
        .map((field) => field.name)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldMetadata, nulls, readOnly, system, defaultOnCreate, booleanIfFalse]);

  useNonInitialEffect(() => {
    onFields(fields);
  }, [fields, onFields]);

  useNonInitialEffect(() => {
    onOptionsChange({
      includeNullFields: nulls,
      includeBooleanIfFalse: booleanIfFalse,
    });
  }, [booleanIfFalse, nulls, onOptionsChange]);

  return (
    <Grid vertical>
      <fieldset className="slds-form-element">
        <legend className="slds-form-element__legend slds-form-element__label">Field Options</legend>
        <Checkbox id="rec-to-apex-nulls" checked={nulls} label="Include null fields" onChange={(value) => setNulls(value)} />
        <Checkbox id="rec-to-apex-readOnly" checked={readOnly} label="Include readonly fields" onChange={(value) => setReadOnly(value)} />
        <Checkbox
          id="rec-to-apex-system"
          checked={system}
          label="Include system fields"
          labelHelp="If true, will include system timestamp and created/modified by fields"
          onChange={(value) => setSystem(value)}
        />
        <Checkbox
          id="rec-to-apex-defaultOnCreate"
          checked={defaultOnCreate}
          label="Include default on create fields"
          labelHelp="If true, will include fields that get a default value on record creation"
          onChange={(value) => setDefaultOnCreate(value)}
        />
        <Checkbox
          id="rec-to-apex-booleanIfFalse"
          checked={booleanIfFalse}
          label="Include boolean fields if false"
          labelHelp="If true, boolean values will be included even if the value if false"
          onChange={(value) => setBooleanIfFalse(value)}
        />
      </fieldset>
    </Grid>
  );
};

export default QueryResultsGetRecAsApexFieldOptions;
