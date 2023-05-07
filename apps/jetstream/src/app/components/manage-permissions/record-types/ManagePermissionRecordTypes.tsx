import { queryAll, retrieveMetadataFromListMetadata } from '@jetstream/shared/data';
import { pollRetrieveMetadataResultsUntilDone, useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer } from '@jetstream/ui';
import JSZip from 'jszip';
import isString from 'lodash/isString';
import { forwardRef, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { composeQuery, getField } from 'soql-parser-js';
import { applicationCookieState, selectedOrgState } from '../../../app-state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionRecordTypesProps {}

export const ManagePermissionRecordTypes = forwardRef<any, ManagePermissionRecordTypesProps>(({}, ref) => {
  const isMounted = useRef(true);
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl, window.electron?.isFocused);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    // get some data from the server
    // describe sobject gives me list of recordTypeInfos
    // get tooling record for RecordType gives me list of picklist values for each record type

    // readMetadata(selectedOrg, 'CustomObject', 'Account')

    // metadata job and include -> layouts, objects, profiles
    // object will give record types and picklist values
    // profiles will give layout assignments
    // unzip and parse xml using DOM

    const layoutFullNames = await queryAll<{ EntityDefinition: { QualifiedApiName: string }; Name: string }>(
      selectedOrg,
      composeQuery({
        sObject: 'Layout',
        fields: [getField('Name'), getField('EntityDefinition.QualifiedApiName')],
        where: {
          left: {
            field: 'EntityDefinition.QualifiedApiName',
            operator: '=',
            value: ['Account'],
            literalType: 'STRING',
          },
        },
      }),
      true
    ).then((results) =>
      results.queryResults.records.map(({ EntityDefinition, Name }) => ({
        fullName: encodeURIComponent(`${EntityDefinition.QualifiedApiName}-${Name}`),
      }))
    );

    const recordTypeFullNames = await queryAll<{ SobjectType: string; DeveloperName: string }>(
      selectedOrg,
      composeQuery({
        sObject: 'RecordType',
        fields: [getField('DeveloperName'), getField('SobjectType')],
        where: {
          left: {
            field: 'SobjectType',
            operator: '=',
            value: ['Account'],
            literalType: 'STRING',
          },
        },
      }),
      false
    ).then((results) =>
      results.queryResults.records.map(({ SobjectType, DeveloperName }) => ({
        fullName: encodeURIComponent(`${SobjectType}.${DeveloperName}`),
      }))
    );

    const { id } = await retrieveMetadataFromListMetadata(selectedOrg, {
      // CustomObject: [ // TODO: do we truly need to include this? it will increase the response payload size
      //   {fullName: 'Account'}, // user will provide these
      // ],
      Layout: layoutFullNames,
      // Should we include EVERY profile, or have the user specify which ones?
      Profile: [{ fullName: 'Admin' }],
      RecordType: recordTypeFullNames,
    });

    const results = await pollRetrieveMetadataResultsUntilDone(selectedOrg, id);

    if (isMounted.current) {
      if (isString(results.zipFile)) {
        const salesforcePackage = await JSZip.loadAsync(results.zipFile, { base64: true });

        const filenamesByType = Object.keys(salesforcePackage.files).reduce(
          (
            acc: {
              layouts: { path: string; filename: string }[];
              objects: { path: string; filename: string }[];
              profiles: { path: string; filename: string }[];
            },
            key
          ) => {
            const [folder, file] = key.split('/');
            if (file) {
              if (!acc[folder]) {
                acc[folder] = [];
              }
              acc[folder].push({ path: key, filename: file });
            }
            return acc;
          },
          {
            layouts: [],
            objects: [],
            profiles: [],
          }
        );

        // TODO:
        // await Promise.all([
        //   ...filenamesByType.layouts.map(layout => salesforcePackage.file(layout)?.async('string')),
        // ])

        // TODO: we are going to want to operate on these individually since we have to take different action to decode
        // parseProfile
        // parseRecordTypesFromCustomObject
        const fileContent = Promise.all(
          [
            'objects/Account.object', // FIXME:
            'profiles/Admin.profile', // FIXME:
            // layouts/Account-Account %28Sales%29 Layout.layout
            ...layoutFullNames.map((fullName) => `layouts/${fullName}.layout`),
            // Record Types are included in CustomObject
            // ...recordTypeFullNames.map(fullName => `${fullName}.recordType-meta.xml`),
          ].map((filename) => salesforcePackage.file(filename)?.async('string'))
        );

        // fileProperties.content = await data.file(fileProperties.fileName)?.async('string');

        notifyUser('Your metadata is ready to view', { tag: 'view-or-compare' });
      } else {
        throw new Error(results.errorMessage || 'No data was returned from Salesforce');
      }
    }
  }

  return (
    <div>
      <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={15}>
        <button className="slds-button slds-button_primary" onClick={fetchData}>
          Fetch
        </button>
      </AutoFullHeightContainer>
    </div>
  );
});

export default ManagePermissionRecordTypes;
