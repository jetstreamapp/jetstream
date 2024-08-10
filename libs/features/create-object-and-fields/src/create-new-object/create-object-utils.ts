import { queryAll, sobjectOperation } from '@jetstream/shared/data';
import { REGEX, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { Maybe, ObjectPermissionRecordInsert, RecordResult, SalesforceOrgUi, TabPermissionRecordInsert } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import JSZip from 'jszip';
import partition from 'lodash/partition';
import { CreateFieldParams, CreateObjectPayload, CreateObjectPermissions } from './create-object-types';

/**
 * Set dependent permissions based on what selection was made
 */
export function setSObjectPermissionDependencies(
  permissions: CreateObjectPermissions,
  modifiedKey: keyof CreateObjectPermissions,
  newValue: boolean
) {
  const output = { ...permissions };
  let fieldsToSetIfTrue: (keyof CreateObjectPermissions)[] = [];
  let fieldsToSetIfFalse: (keyof CreateObjectPermissions)[] = [];
  if (modifiedKey === 'allowCreate') {
    output.allowCreate = newValue;
    fieldsToSetIfTrue = ['allowRead'];
    fieldsToSetIfFalse = [];
  } else if (modifiedKey === 'allowRead') {
    output.allowRead = newValue;
    fieldsToSetIfTrue = [];
    fieldsToSetIfFalse = ['allowCreate', 'allowEdit', 'allowDelete', 'viewAllRecords', 'modifyAllRecords'];
  } else if (modifiedKey === 'allowEdit') {
    output.allowEdit = newValue;
    fieldsToSetIfTrue = ['allowRead'];
    fieldsToSetIfFalse = ['allowDelete', 'modifyAllRecords'];
  } else if (modifiedKey === 'allowDelete') {
    output.allowDelete = newValue;
    fieldsToSetIfTrue = ['allowRead', 'allowEdit'];
    fieldsToSetIfFalse = ['modifyAllRecords'];
  } else if (modifiedKey === 'viewAllRecords') {
    output.viewAllRecords = newValue;
    fieldsToSetIfTrue = ['allowRead'];
    fieldsToSetIfFalse = ['modifyAllRecords'];
  } else if (modifiedKey === 'modifyAllRecords') {
    output.modifyAllRecords = newValue;
    fieldsToSetIfTrue = ['allowRead', 'allowEdit', 'allowDelete', 'viewAllRecords'];
    fieldsToSetIfFalse = [];
  }
  if (newValue) {
    fieldsToSetIfTrue.forEach((prop) => (output[prop] = newValue));
  } else {
    fieldsToSetIfFalse.forEach((prop) => (output[prop] = newValue));
  }
  return output;
}

export function generateApiNameFromLabel(value: string) {
  let apiNameLabel = value;
  if (apiNameLabel) {
    apiNameLabel = apiNameLabel
      .replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '_')
      .replace(REGEX.STARTS_WITH_UNDERSCORE, '')
      .replace(REGEX.CONSECUTIVE_UNDERSCORES, '_')
      .replace(REGEX.ENDS_WITH_NON_ALPHANUMERIC, '');
    if (REGEX.STARTS_WITH_NUMBER.test(apiNameLabel)) {
      apiNameLabel = `X${apiNameLabel}`;
    }
    if (apiNameLabel.length > 40) {
      apiNameLabel = apiNameLabel.substring(0, 40);
    }
  }
  return apiNameLabel ? `${apiNameLabel}__c` : '';
}

export function getObjectAndTabPermissionRecords(
  { apiName: apiNameWithoutNamespace, createTab, profiles, permissionSets, objectPermissions }: CreateFieldParams,
  orgNamespacePrefix?: Maybe<string>
) {
  const apiName = orgNamespacePrefix ? `${orgNamespacePrefix}__${apiNameWithoutNamespace}` : apiNameWithoutNamespace;
  const _objectPermissions: ObjectPermissionRecordInsert[] = [];
  const tabPermissions: TabPermissionRecordInsert[] = [];

  profiles.forEach((id) => {
    const permissions = objectPermissions.scope === 'ALL' ? objectPermissions.permissions : objectPermissions.permissions[id];
    _objectPermissions.push({
      attributes: { type: 'ObjectPermissions' },
      ParentId: id,
      PermissionsCreate: permissions.allowCreate,
      PermissionsDelete: permissions.allowDelete,
      PermissionsEdit: permissions.allowEdit,
      PermissionsModifyAllRecords: permissions.modifyAllRecords,
      PermissionsRead: permissions.allowRead,
      PermissionsViewAllRecords: permissions.viewAllRecords,
      SobjectType: apiName,
    });
    if (createTab) {
      tabPermissions.push({
        attributes: { type: 'PermissionSetTabSetting' },
        ParentId: id,
        Name: apiName,
        Visibility: 'DefaultOn',
      });
    }
  });

  permissionSets.forEach((id) => {
    const permissions = objectPermissions.scope === 'ALL' ? objectPermissions.permissions : objectPermissions.permissions[id];
    _objectPermissions.push({
      attributes: { type: 'ObjectPermissions' },
      ParentId: id,
      PermissionsCreate: permissions.allowCreate,
      PermissionsDelete: permissions.allowDelete,
      PermissionsEdit: permissions.allowEdit,
      PermissionsModifyAllRecords: permissions.modifyAllRecords,
      PermissionsRead: permissions.allowRead,
      PermissionsViewAllRecords: permissions.viewAllRecords,
      SobjectType: apiName,
    });
    if (createTab) {
      tabPermissions.push({
        attributes: { type: 'PermissionSetTabSetting' },
        ParentId: id,
        Name: apiName,
        Visibility: 'DefaultOn',
      });
    }
  });
  return {
    tabPermissions,
    objectPermissions: _objectPermissions,
  };
}

export async function getMetadataPackage(
  apiVersion: string,
  { apiName, createTab, tabMotif, payload, permissionSets, profiles }: CreateFieldParams
) {
  const customObjectXml = getObjectXml(payload);

  const zip = new JSZip();
  zip.file(`objects/${apiName}.object`, customObjectXml);

  if (createTab) {
    const customTabXml = getTabXml(tabMotif);
    zip.file(`tabs/${apiName}.tab`, customTabXml);
  }

  zip.file('package.xml', getPackageXml(apiName, apiVersion, createTab, profiles, permissionSets));

  const file = await zip.generateAsync({ type: 'arraybuffer' });

  return file;
}

export async function savePermissionRecords(
  org: SalesforceOrgUi,
  objectApiName: string,
  permissionRecords: {
    objectPermissions: ObjectPermissionRecordInsert[];
    tabPermissions: TabPermissionRecordInsert[];
  }
) {
  const existingPermissions = await Promise.all([
    queryAll<{ ParentId: string }>(
      org,
      composeQuery({
        fields: [getField('ParentId')],
        sObject: 'ObjectPermissions',
        where: { left: { field: 'SobjectType', operator: '=', value: objectApiName, literalType: 'STRING' } },
      })
    ),
    queryAll<{ ParentId: string }>(
      org,
      composeQuery({
        fields: [getField('ParentId')],
        sObject: 'PermissionSetTabSetting',
        where: { left: { field: 'Name', operator: '=', value: objectApiName, literalType: 'STRING' } },
      })
    ),
  ]).then(
    ([query1, query2]) =>
      new Set([
        ...query1.queryResults.records.map((record) => record.ParentId),
        ...query2.queryResults.records.map((record) => record.ParentId),
      ])
  );

  const [skippedObjectPermissions, objectPermissions] = partition(permissionRecords.objectPermissions, (record) =>
    existingPermissions.has(record.ParentId)
  );
  const [skippedTabPermissions, tabPermissions] = partition(permissionRecords.tabPermissions, (record) =>
    existingPermissions.has(record.ParentId)
  );

  const recordInsertResults: RecordResult[] = (
    await Promise.all([
      ...splitArrayToMaxSize(objectPermissions, 200).map((records) => {
        if (records.length === 0) {
          return [];
        }
        return sobjectOperation(org, 'ObjectPermissions', 'create', { records }, { allOrNone: false });
      }),
      ...splitArrayToMaxSize(tabPermissions, 200).map((records) => {
        if (records.length === 0) {
          return [];
        }
        return sobjectOperation(org, 'PermissionSetTabSetting', 'create', { records }, { allOrNone: false });
      }),
    ])
  ).flat();

  return {
    skippedObjectPermissions,
    skippedTabPermissions,
    recordInsertResults,
  };
}

export function getObjectXml(payload: CreateObjectPayload) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">
  <allowInChatterGroups>${payload.allowInChatterGroups}</allowInChatterGroups>
  <compactLayoutAssignment>${payload.compactLayoutAssignment}</compactLayoutAssignment>
  <deploymentStatus>${payload.deploymentStatus}</deploymentStatus>
  <description>${payload.description || ''}</description>
  <enableActivities>${payload.enableActivities}</enableActivities>
  <enableBulkApi>${payload.enableBulkApi}</enableBulkApi>
  <enableEnhancedLookup>${payload.enableEnhancedLookup}</enableEnhancedLookup>
  <enableFeeds>${payload.enableFeeds}</enableFeeds>
  <enableHistory>${payload.enableHistory}</enableHistory>
  <enableLicensing>${payload.enableLicensing}</enableLicensing>
  <enableReports>${payload.enableReports}</enableReports>
  <enableSearch>${payload.enableSearch}</enableSearch>
  <enableSharing>${payload.enableSharing}</enableSharing>
  <enableStreamingApi>${payload.enableStreamingApi}</enableStreamingApi>
  <externalSharingModel>${payload.externalSharingModel}</externalSharingModel>
  <label>${payload.label}</label>
  <nameField>
      <label>${payload.nameField.label}</label>
      <trackHistory>${payload.nameField.trackHistory}</trackHistory>
      <type>${payload.nameField.type}</type>
${payload.nameField.type === 'AutoNumber' && `<displayFormat>${payload.nameField.displayFormat}</displayFormat>`}
${payload.nameField.type === 'AutoNumber' && `<startingNumber>${payload.nameField.startingNumber}</startingNumber>`}
  </nameField>
  <pluralLabel>${payload.pluralLabel}</pluralLabel>
  <recordTypeTrackHistory>${payload.recordTypeTrackHistory}</recordTypeTrackHistory>
  <sharingModel>${payload.sharingModel}</sharingModel>
  <startsWith>${payload.startsWith}</startsWith>
  <visibility>${payload.visibility}</visibility>
</CustomObject>`;
}

export function getTabXml(tabMotif: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<CustomTab xmlns="http://soap.sforce.com/2006/04/metadata">
  <customObject>true</customObject>
  <motif>${tabMotif}</motif>
</CustomTab>`;
}

export function getPackageXml(apiName: string, apiVersion: string, createTab: boolean, profiles: string[], permissionSets: string[]) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <version>${apiVersion.replace('v', '')}</version>
  <types>
    <members>${apiName}</members>
    <name>CustomObject</name>
  </types>`;

  if (createTab) {
    xml += `
  <types>
    <members>${apiName}</members>
    <name>CustomTab</name>
  </types>`;
  }

  xml += `\n</Package>`;

  return xml;
}
