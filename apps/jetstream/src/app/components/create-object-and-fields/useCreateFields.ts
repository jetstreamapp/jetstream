import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { useCallback, useReducer, useState } from 'react';
import { FieldDefinitionType, FieldValue, FieldValues } from './create-fields-types';
import { calculateFieldValidity, getInitialValues, preparePayload } from './create-fields-utils';

export default function useCreateFields() {
  const [loading, setLoading] = useState(false);
  // TODO:
  const [results, setResults] = useState([]);

  const deployFields = useCallback(async (sobjects: string[], rows: FieldValues[]) => {
    try {
      setLoading(true);
      // TODO: sobjects
      const payload = preparePayload(sobjects, rows);
      splitArrayToMaxSize(payload);
      // split to max array
      // deploy to Salesforce using tooling api
    } catch (ex) {
      // fatal error
      // TODO:
    } finally {
      setLoading(true);
    }
  }, []);
}
