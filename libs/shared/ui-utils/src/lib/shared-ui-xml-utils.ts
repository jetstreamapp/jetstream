type MetadataType = string;
type MetadataTypeFullName = string;

const SOAP_XML_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';

export const xmlUtils = {
  SOAP_XML_NAMESPACE,
  appendElementToXml,
  appendTextElementToXml,
  generatePackageXml,
  generateXmlDocument,
  serializeXml,
};

/**
 * Generate an XML document with a specified root node name and namespace.
 * @param rootNodeName
 * @param namespace - default is SOAP_XML_NAMESPACE (http://soap.sforce.com/2006/04/metadata)
 * @returns
 */
function generateXmlDocument(rootNodeName: string, namespace: string = SOAP_XML_NAMESPACE) {
  const doc = document.implementation.createDocument(namespace, rootNodeName);
  doc.insertBefore(doc.createProcessingInstruction('xml', 'version="1.0" encoding="UTF-8"'), doc.documentElement);
  return doc;
}

/**
 * Produce a package.xml file for the specified API version and metadata types.
 */
function generatePackageXml(apiVersion: string, values: Record<MetadataType, MetadataTypeFullName[]>) {
  if (!apiVersion) {
    throw new Error('API version is required');
  }

  const doc = generateXmlDocument('Package');
  const packageElement = doc.documentElement;

  Object.entries(values).forEach(([type, fullNames]) => {
    const typesElement = doc.createElementNS(SOAP_XML_NAMESPACE, 'types');
    fullNames.forEach((fullName) => {
      appendTextElementToXml({ namespace: SOAP_XML_NAMESPACE, tagName: 'members', value: fullName, parent: typesElement });
    });

    appendTextElementToXml({ namespace: SOAP_XML_NAMESPACE, tagName: 'name', value: type, parent: typesElement });

    packageElement.appendChild(typesElement);
  });

  appendTextElementToXml({ namespace: SOAP_XML_NAMESPACE, tagName: 'version', value: apiVersion.replace('v', ''), parent: packageElement });

  return serializeXml(doc);
}

/**
 * Serialize XML and pretty print if supported
 */
function serializeXml(doc: XMLDocument): string {
  if (!('XSLTProcessor' in globalThis)) {
    const sourceXml = new XMLSerializer().serializeToString(doc);
    return sourceXml;
  }
  const xsltDoc = new DOMParser().parseFromString(
    `<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:strip-space elements="*"/>
  <xsl:template match="para[content-style][not(text())]">
    <xsl:value-of select="normalize-space(.)"/>
  </xsl:template>
  <xsl:template match="node()|@*">
    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>
  </xsl:template>
  <xsl:output indent="yes"/>
</xsl:stylesheet>`,
    'application/xml'
  );

  const xsltProcessor = new XSLTProcessor();
  xsltProcessor.importStylesheet(xsltDoc);
  const resultDoc = xsltProcessor.transformToDocument(doc);
  const resultXml = new XMLSerializer().serializeToString(resultDoc);
  return resultXml;
}

/**
 * Appends a node to an XML element with the specified namespace and tag name.
 */
function appendElementToXml({ namespace, tagName, parent }: { namespace: string; tagName: string; parent: Element }) {
  const membersElement = parent.ownerDocument.createElementNS(namespace, tagName);
  parent.appendChild(membersElement);
  return membersElement;
}

/**
 * Appends a text node to an XML element with the specified namespace and tag name.
 */
function appendTextElementToXml({
  namespace,
  tagName,
  value,
  parent,
}: {
  namespace: string;
  tagName: string;
  value: string | number | boolean;
  parent: Element;
}) {
  const element = appendElementToXml({ namespace, tagName, parent });
  element.textContent = `${value ?? ''}`;
  return element;
}
