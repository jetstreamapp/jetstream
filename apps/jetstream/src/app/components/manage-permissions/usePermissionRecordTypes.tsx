import { logger } from '@jetstream/shared/client-logger';
import { PROFILE_LABEL_TO_FULL_NAME_MAP } from '@jetstream/shared/constants';
import { queryAll, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import {
  ParsedProfile,
  ParsedRecordTypePicklistValues,
  parseProfile,
  parseRecordTypePicklistValuesFromCustomObject,
  pollRetrieveMetadataResultsUntilDone,
  useRollbar,
} from '@jetstream/shared/ui-utils';
import { encodeHtmlEntitySalesforceCompatible, getMapOf, orderObjectsBy } from '@jetstream/shared/utils';
import { PermissionSetProfileRecord, SalesforceOrgUi } from '@jetstream/types';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { useCallback, useEffect, useRef, useState } from 'react';
import { composeQuery, getField } from 'soql-parser-js';

export type RecordTypeData = Awaited<ReturnType<typeof fetchRecordTypeData>>;

export function usePermissionRecordTypes(selectedOrg: SalesforceOrgUi, sobjects: string[], profiles: PermissionSetProfileRecord[]) {
  const isMounted = useRef(true);
  const rollbar = useRollbar();
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const [recordTypeData, setRecordTypeData] = useState<RecordTypeData>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (selectedOrg) {
      fetchMetadata();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, sobjects]);

  const fetchMetadata = useCallback(async () => {
    try {
      // init and reset in case of prior
      setLoading(true);
      setHasError(false);
      setRecordTypeData(undefined);

      const results = await fetchRecordTypeData(
        selectedOrg,
        sobjects,
        profiles.map(({ Name }) => Name)
      );

      logger.log('[usePermissionRecordTypes]', results);

      if (isMounted.current) {
        setRecordTypeData(results);
      }
    } catch (ex) {
      logger.warn('[usePermissionRecordTypes][ERROR]', ex.message);
      rollbar.error('[usePermissionRecordTypes][ERROR]', ex);
      if (isMounted.current) {
        setHasError(true);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [profiles, rollbar, selectedOrg, sobjects]);

  return {
    loading,
    hasError,
    recordTypeData,
  };
}

/**
 *
 * @param selectedOrg
 * @param sobjects
 * @param profiles
 * @returns
 */
async function fetchRecordTypeData(selectedOrg: SalesforceOrgUi, sobjects: string[], profileNames: string[]) {
  const layouts = await queryAll<{ EntityDefinition: { QualifiedApiName: string }; Name: string }>(
    selectedOrg,
    composeQuery({
      sObject: 'Layout',
      fields: [getField('Name'), getField('EntityDefinition.QualifiedApiName')],
      where: {
        left: {
          field: 'EntityDefinition.QualifiedApiName',
          operator: 'IN',
          value: sobjects,
          literalType: 'STRING',
        },
      },
    }),
    true
  ).then((results) =>
    results.queryResults.records.map((record) => ({
      ...record,
      fullName: encodeHtmlEntitySalesforceCompatible(`${record.EntityDefinition.QualifiedApiName}-${record.Name}`),
    }))
  );

  const recordTypes = await queryAll<{ SobjectType: string; DeveloperName: string }>(
    selectedOrg,
    composeQuery({
      sObject: 'RecordType',
      fields: [getField('DeveloperName'), getField('SobjectType')],
      where: {
        left: {
          field: 'SobjectType',
          operator: 'IN',
          value: sobjects,
          literalType: 'STRING',
        },
      },
    }),
    false
  ).then((results) =>
    results.queryResults.records.map((record) => ({
      ...record,
      fullName: encodeHtmlEntitySalesforceCompatible(`${record.SobjectType}.${record.DeveloperName}`),
    }))
  );

  const { id } = await retrieveMetadataFromListMetadata(selectedOrg, {
    Layout: layouts,
    Profile: profileNames.map((profile) => ({ fullName: PROFILE_LABEL_TO_FULL_NAME_MAP[profile] || profile })),
    RecordType: recordTypes,
  });

  const recordTypeVisibilitiesMap = getMapOf(
    recordTypes.map((recordType) => ({
      default: false,
      recordType: recordType.fullName,
      visible: false,
    })),
    'recordType'
  );

  const results = await pollRetrieveMetadataResultsUntilDone(selectedOrg, id);

  if (isString(results.zipFile)) {
    const salesforcePackage = await JSZip.loadAsync(results.zipFile, { base64: true });

    const profilesWithLayoutAndRecordTypeVisibilities = await Promise.all(
      profileNames.map((profile): Promise<{ profile: string; profileFullName: string } & ParsedProfile> => {
        const decodedKeyMap = Object.keys(salesforcePackage.files).reduce((acc, item) => {
          acc[decodeURIComponent(item)] = item;
          return acc;
        }, {});

        const file = salesforcePackage.file(decodedKeyMap[`profiles/${PROFILE_LABEL_TO_FULL_NAME_MAP[profile] || profile}.profile`]);
        if (file) {
          return file.async('string').then((results) => {
            const parsedResults = parseProfile(results);
            return {
              profile,
              profileFullName: PROFILE_LABEL_TO_FULL_NAME_MAP[profile] || profile,
              layoutAssignments: parsedResults.layoutAssignments,
              // Fill in missing record types with defaults since they are omitted from the metadata response
              recordTypeVisibilities: orderObjectsBy(
                Object.values({ ...recordTypeVisibilitiesMap, ...getMapOf(parsedResults.recordTypeVisibilities, 'recordType') }),
                'recordType'
              ),
            };
          });
        }
        return Promise.resolve({
          profile,
          profileFullName: PROFILE_LABEL_TO_FULL_NAME_MAP[profile] || profile,
          recordTypeVisibilities: Object.values(recordTypeVisibilitiesMap),
          layoutAssignments: [], // FIXME: this needs to have the defaults so that we know if it was modified
        });
      })
    );

    const sobjectsWithRecordTypes = await Promise.all(
      sobjects.map((sobject): Promise<{ sobject: string; picklists: ParsedRecordTypePicklistValues }> => {
        const decodedKeyMap = Object.keys(salesforcePackage.files).reduce((acc, item) => {
          acc[decodeURIComponent(item)] = item;
          return acc;
        }, {});
        const file = salesforcePackage.file(decodedKeyMap[`objects/${decodedKeyMap[sobject]}.object`]);
        if (file) {
          return file.async('string').then((results) => ({
            sobject,
            picklists: parseRecordTypePicklistValuesFromCustomObject(results),
          }));
        }
        return Promise.resolve({ sobject, picklists: [] });
      })
    );

    return {
      layouts,
      recordTypes,
      profilesWithLayoutAndRecordTypeVisibilities,
      sobjectsWithRecordTypes,
    };
  }

  throw new Error('Metadata request did not contain any content');
}
