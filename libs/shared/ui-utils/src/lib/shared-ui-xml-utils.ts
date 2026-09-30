import { build } from '@jetstreamapp/simple-xml';

type MetadataType = string;
type MetadataTypeFullName = string;

const SOAP_XML_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';

export const xmlUtils = {
  buildMetadataXml,
  generatePackageXml,
};

/**
 * Build a metadata api xml file (e.g. package.xml or an object file) from a plain object.
 * Keys are emitted in insertion order and `undefined` values are skipped.
 *
 * This is string based on purpose, the DOM + XSLTProcessor approach this replaced produced different output per browser
 * (Firefox threw, Chromium and WebKit dropped the xml declaration) and Chromium is removing XSLT.
 *
 * @param rootNodeName - e.g. Package, CustomObject
 * @param content - children of the root node, the metadata namespace is added to the root node
 */
function buildMetadataXml(rootNodeName: string, content: Record<string, unknown>): string {
  return build(
    { [rootNodeName]: { '@xmlns': SOAP_XML_NAMESPACE, ...content } },
    { declaration: true, format: true, ignoreAttributes: false, attributeNamePrefix: '@' },
  );
}

/**
 * Produce a package.xml file for the specified API version and metadata types.
 */
function generatePackageXml(apiVersion: string, values: Record<MetadataType, MetadataTypeFullName[]>) {
  if (!apiVersion) {
    throw new Error('API version is required');
  }

  return buildMetadataXml('Package', {
    types: Object.entries(values).map(([name, members]) => ({ members, name })),
    version: apiVersion.replace('v', ''),
  });
}
