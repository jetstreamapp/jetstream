import { ensureArray, getFullNameFromListMetadata, orderObjectsBy } from '@jetstream/shared/utils';
import { ListMetadataResult, Maybe, PackageTypeMembers, RetrieveRequest } from '@jetstream/types';
import lodashGet from 'lodash/get';
import isObjectLike from 'lodash/isObjectLike';
import isString from 'lodash/isString';
import { create as xmlBuilder } from 'xmlbuilder2';

const VALID_PACKAGE_VERSION = /^[0-9]+\.[0-9]+$/;

/**
 * Mutates the input types by moving "Folder" types to their parent type.
 * Deletes the original "Folder" type entries from the input object and appends their items to the parent type array.
 * Special case: If the folder type is "EmailFolder", its items are moved to "EmailTemplate" instead of "Email".
 *
 * @param types Map of metadata types to their items. This object will be mutated: folder types will be removed and their items moved.
 */
function mutateFolderMetadataTypes(types: Record<string, Pick<ListMetadataResult, 'fullName' | 'namespacePrefix'>[]>) {
  // Move the "Folder" types to their parent type
  Object.keys(types)
    .filter((metadataType) => metadataType.endsWith('Folder'))
    .forEach((metadataType) => {
      let correctType = metadataType.replace('Folder', '');
      // Special Case - Classic email templates have a snowflake naming convention, so we cannot simply remove "Folder" from the end
      if (correctType === 'Email') {
        correctType = 'EmailTemplate';
      }
      const items = types[metadataType];
      types[correctType] = types[correctType] || [];
      items.forEach((item) => {
        types[correctType].push({
          fullName: item.fullName,
          namespacePrefix: item.namespacePrefix,
        });
      });
      delete types[metadataType];
    });
}

// TODO: deprecate in favor of xml-utils version
export function buildPackageXml(
  types: Record<string, Pick<ListMetadataResult, 'fullName' | 'namespacePrefix'>[]>,
  version: string,
  otherFields: Maybe<Record<string, string>> = {},
  prettyPrint = true,
) {
  // prettier-ignore
  const packageNode = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
    .ele('Package', { xmlns: 'http://soap.sforce.com/2006/04/metadata' });

  mutateFolderMetadataTypes(types);

  Object.keys(types).forEach((metadataType) => {
    const typesNode = packageNode.ele('types');
    if (types[metadataType].length) {
      orderObjectsBy(types[metadataType], 'fullName').forEach(({ fullName, namespacePrefix }) => {
        typesNode.ele('members').txt(
          getFullNameFromListMetadata({
            fullName,
            metadataType,
            namespace: namespacePrefix,
          }),
        );
      });
      typesNode.ele('name').txt(metadataType);
    }
  });

  if (otherFields) {
    Object.keys(otherFields).forEach((key) => {
      packageNode.ele(key).txt(otherFields[key]);
    });
  }

  packageNode.ele('version').txt(version);

  return packageNode.end({ prettyPrint });
}

export function getRetrieveRequestFromListMetadata(
  types: Record<string, Pick<ListMetadataResult, 'fullName' | 'namespacePrefix'>[]>,
  version: string,
) {
  mutateFolderMetadataTypes(types);
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retrieve_request.htm
  const retrieveRequest: RetrieveRequest = {
    apiVersion: version,
    singlePackage: true,
    unpackaged: {
      types: Object.keys(types).map((metadataName) => {
        const members = types[metadataName];
        return {
          members: members.map(({ fullName, namespacePrefix }) => {
            return getFullNameFromListMetadata({
              fullName,
              metadataType: metadataName,
              namespace: namespacePrefix,
            });
          }),
          name: metadataName,
        };
      }),
      version,
    },
  };
  return retrieveRequest;
}

/**
 * TODO: should we handle other packages fields?
 *
 * @param packageManifest
 */
export function getRetrieveRequestFromManifest(packageManifest: string) {
  let manifestXml;
  try {
    manifestXml = xmlBuilder(packageManifest).toObject({ wellFormed: true });
  } catch {
    throw new Error('The package manifest format is invalid');
  }
  // validate parsed package manifest
  if (!manifestXml || Array.isArray(manifestXml)) {
    throw new Error('The package manifest format is invalid');
  } else {
    const version: string = lodashGet(manifestXml, 'Package.version');
    let types: PackageTypeMembers[] = lodashGet(manifestXml, 'Package.types');
    if (isObjectLike(types)) {
      types = ensureArray(types);
    }
    if (!isString(version) || !VALID_PACKAGE_VERSION.test(version)) {
      throw new Error('The package manifest version is invalid or is missing');
    } else if (!Array.isArray(types) || !types.length) {
      throw new Error('The package manifest is missing types');
    }

    const retrieveRequest: RetrieveRequest = {
      apiVersion: version,
      unpackaged: {
        types,
        version,
      },
    };
    return retrieveRequest;
  }
}
