import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { describeSObject, readMetadata } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessageAndStackObj, groupByFlat, orderValues, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { DescribeSObjectResult, ReadMetadataRecordType, ReadMetadataRecordTypeExtended } from '@jetstream/types';
import { fromRecordTypeManagerState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { RecordTypePicklistConfiguration, SobjectWithPicklistValues } from '../types/record-types.types';
import { recordTypeReducer, RecordTypeReducerFn } from './record-types.reducer';
import { repairAndEnrichMetadata } from './record-types.utils';

const ignoredPicklistFields = new Set(['CleanStatus', 'ContactSource', 'CurrencyIsoCode']);
const ignoredPicklistObjectFields = new Set([
  'Campaign.LeadSource',
  'Campaign.Salutation',
  'CampaignMember.Status',
  'Case.Status',
  'Lead.Status',
  'Opportunity.Stage',
  'Solution.Status',
]);
const ignoredPicklistSuffix = ['StateCode', 'CountryCode', 'GeocodeAccuracy', 'StateCode__s', 'CountryCode__s', 'GeocodeAccuracy__s'];

export function useLoadRecordTypeData() {
  const isMounted = useRef(true);
  const rollbar = useRollbar();

  const selectedOrg = useRecoilValue(selectedOrgState);
  const selectedRecordTypes = useRecoilValue(fromRecordTypeManagerState.selectedRecordTypes);

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const [sobjects, setSobjects] = useState<Record<string, DescribeSObjectResult>>({});
  const [recordTypeMetadataByFullName, setRecordTypeMetadataByFullName] = useState<Record<string, ReadMetadataRecordTypeExtended>>({});

  const [
    { objectMetadata, modifiedValues, errorsByField: configurationErrorsByField, errorsByRecordType: configurationErrorsByRecordType },
    dispatch,
  ] = useReducer<RecordTypeReducerFn>(recordTypeReducer, {
    allValues: [],
    modifiedValues: [],
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadRecordTypePicklist = useCallback(async () => {
    const recordTypes: ReadMetadataRecordTypeExtended[] = [];

    const metadata = splitArrayToMaxSize(selectedRecordTypes, 10);
    for (const item of metadata) {
      if (!isMounted.current) {
        return recordTypes;
      }
      const items = await readMetadata<ReadMetadataRecordType>(
        selectedOrg,
        'RecordType',
        item.map(({ fullName }) => fullName)
      );
      recordTypes.push(...items.map((recordType) => repairAndEnrichMetadata(recordType)));
    }

    logger.info('readMetadata', recordTypes);

    setRecordTypeMetadataByFullName(groupByFlat(recordTypes, 'fullName'));
    return recordTypes;
  }, [selectedOrg, selectedRecordTypes]);

  const loadObjectMetadata = useCallback(
    async (recordTypes: ReadMetadataRecordTypeExtended[]) => {
      const sobjectNames = new Set<string>(recordTypes.map(({ sobject }) => sobject));
      const _sobjects: Record<string, DescribeSObjectResult> = {};

      for (const sobject of orderValues(Array.from(sobjectNames))) {
        try {
          if (!isMounted.current) {
            return _sobjects;
          }
          _sobjects[sobject] = await describeSObject(selectedOrg, sobject).then((item) => item.data);
        } catch (ex) {
          logger.warn(`Error loading object ${sobject}`, ex);
          rollbar.error('Record Type Manager: Error loading object', sobject, getErrorMessageAndStackObj(ex));
        }
      }
      setSobjects(_sobjects);
      return _sobjects;
    },
    [rollbar, selectedOrg]
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      // const [records, sobjects] = await Promise.all([, loadObjectMetadata()]);
      const recordTypes = await loadRecordTypePicklist();
      const sobjects = await loadObjectMetadata(recordTypes);

      const objectFieldsBySObject = Object.values(sobjects).reduce((acc: Record<string, SobjectWithPicklistValues>, sobject) => {
        const output: SobjectWithPicklistValues = {
          sobjectName: sobject.name,
          sobjectLabel: sobject.label,
          picklistValues: {},
          recordTypeValues: {},
        };

        const picklistFields = sobject.fields.filter(
          ({ name, type }) =>
            (type === 'picklist' || type === 'multipicklist') &&
            !ignoredPicklistFields.has(name) &&
            !ignoredPicklistObjectFields.has(`${sobject.name}.${name}`) &&
            !ignoredPicklistSuffix.some((suffix) => name.endsWith(suffix))
        );
        const recordTypesForObject = recordTypes.filter((item) => item.sobject === sobject.name);

        picklistFields.forEach((field) => {
          const picklistValues = field.picklistValues || [];

          output.picklistValues[field.name] = {
            fieldName: field.name,
            fieldLabel: field.label,
            values: picklistValues,
          };

          recordTypesForObject.forEach((recordType) => {
            output.recordTypeValues[recordType.recordType] = output.recordTypeValues[recordType.recordType] || {
              fullName: recordType.fullName,
              recordType: recordType.recordType,
              recordTypeLabel: recordType.label,
              sobject: recordType.sobject,
              sobjectLabel: sobject.label,
              picklistValues: {},
            };

            const recordTypePicklistFields = recordType.picklistValues.find(({ fieldName }) => fieldName === field.name);
            if (recordTypePicklistFields) {
              const defaultValue = recordTypePicklistFields.values.find((value) => value.default === 'true');
              const recordTypeValues = new Set(recordTypePicklistFields.values.map(({ fullName }) => fullName));
              output.recordTypeValues[recordType.recordType].picklistValues[field.name] = picklistValues.reduce(
                (acc: RecordTypePicklistConfiguration, value) => {
                  if (recordTypeValues.has(value.value)) {
                    acc.initialValues.add(value.value);
                    acc.currentValues.add(value.value);
                  }
                  if (defaultValue && value.value === defaultValue.fullName) {
                    acc.initialDefaultValue = value.value;
                    acc.defaultValue = value.value;
                  }
                  return acc;
                },
                {
                  fieldName: field.name,
                  fieldLabel: field.label,
                  initialValues: new Set<string>(),
                  currentValues: new Set<string>(),
                  dirtyValues: new Set<string>(),
                  initialDefaultValue: SFDC_BLANK_PICKLIST_VALUE,
                  defaultValue: SFDC_BLANK_PICKLIST_VALUE,
                }
              );
            } else {
              output.recordTypeValues[recordType.recordType].picklistValues[field.name] = {
                fieldName: field.name,
                fieldLabel: field.label,
                initialValues: new Set(),
                currentValues: new Set(),
                dirtyValues: new Set(),
                initialDefaultValue: SFDC_BLANK_PICKLIST_VALUE,
                defaultValue: SFDC_BLANK_PICKLIST_VALUE,
              };
            }
          });
        });

        acc[sobject.name] = output;
        return acc;
      }, {});
      dispatch({ type: 'INIT', payload: objectFieldsBySObject });
      setLoading(false);
      setHasLoaded(true);
      logger.log('objectFieldsBySObject', objectFieldsBySObject);
    } catch (ex) {
      setHasError(true);
      logger.error('Error loading record types', ex);
      rollbar.error('Record Type Manager: Error loading record types', getErrorMessageAndStackObj(ex));
    }
  }, [loadObjectMetadata, loadRecordTypePicklist, rollbar]);

  const resetData = useCallback(async () => {
    dispatch({ type: 'RESET' });
    setSobjects({});
    setRecordTypeMetadataByFullName({});
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    loading,
    hasLoaded,
    hasLoadError: hasError,
    sobjects,
    recordTypeMetadataByFullName,
    objectMetadata,
    modifiedValues,
    configurationErrorsByField,
    configurationErrorsByRecordType,
    resetData,
    dispatch,
  };
}
