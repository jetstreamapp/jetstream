import { ensureBoolean } from '@jetstream/shared/utils';

export type ParsedProfile = ReturnType<typeof parseProfile>;
export type ParsedRecordTypePicklistValues = ReturnType<typeof parseRecordTypePicklistValuesFromCustomObject>;

export function parseProfile(xml: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'text/xml');
  return {
    layoutAssignments: Array.from(xmlDoc.getElementsByTagName('layoutAssignments')).map((node) => {
      return {
        layout: parseAttribute(node, 'layout'),
        recordType: parseAttribute(node, 'recordType'),
      };
    }),
    recordTypeVisibilities: Array.from(xmlDoc.getElementsByTagName('recordTypeVisibilities')).map((node) => {
      return {
        default: ensureBoolean(parseAttribute(node, 'default')),
        recordType: parseAttribute(node, 'recordType') || '',
        visible: ensureBoolean(parseAttribute(node, 'visible')),
      };
    }),
  };
}

export function parseRecordTypePicklistValuesFromCustomObject(xml: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'text/xml');
  return Array.from(xmlDoc.getElementsByTagName('recordTypes')).map((node) => {
    return {
      fullName: parseAttribute(node, 'fullName') || '',
      active: ensureBoolean(parseAttribute(node, 'active')),
      label: parseAttribute(node, 'label') || '',
      picklistValues: parseArrayAttribute(node, 'picklistValues').map((values) => {
        return {
          picklist: parseAttribute(values, 'picklist') || '',
          values: parseArrayAttribute(node, 'values').map((value) => {
            return {
              fullName: parseAttribute(value, 'fullName'),
              default: ensureBoolean(parseAttribute(value, 'default')),
            };
          }),
        };
      }),
    };
  });
}

export function generatePackageXml(types: { name: string; members: string[] }[], apiVersion: string): string {
  const xmlDocument = document.implementation.createDocument(null, 'Package');

  xmlDocument.insertBefore(xmlDocument.createProcessingInstruction('xml', 'version="1.0" encoding="UTF-8"'), xmlDocument.firstChild);

  const rootElement = xmlDocument.documentElement;
  rootElement.setAttribute('xmlns', 'http://soap.sforce.com/2006/04/metadata');

  types.forEach(({ name, members }) => {
    const typesElement = xmlDocument.createElement('types');
    members.forEach((member) => {
      const membersElement = xmlDocument.createElement('members');
      membersElement.textContent = member;
      typesElement.appendChild(membersElement);
    });

    const nameElement = xmlDocument.createElement('name');
    nameElement.textContent = name;
    typesElement.appendChild(nameElement);

    rootElement.appendChild(typesElement);
  });

  // Create the 'version' element and set its value
  const versionElement = xmlDocument.createElement('version');
  versionElement.textContent = apiVersion.replace('v', '');

  rootElement.appendChild(versionElement);

  return new XMLSerializer().serializeToString(xmlDocument);
}

export function generateMetadataXml(rootName: string, types: { name: string; values: Record<string, any> }[]) {
  const xmlDocument = document.implementation.createDocument(null, rootName);

  xmlDocument.insertBefore(xmlDocument.createProcessingInstruction('xml', 'version="1.0" encoding="UTF-8"'), xmlDocument.firstChild);

  const rootElement = xmlDocument.documentElement;
  rootElement.setAttribute('xmlns', 'http://soap.sforce.com/2006/04/metadata');

  types.forEach(({ name, values }) => {
    const containerElement = xmlDocument.createElement(name);
    Object.entries(values).forEach(([key, value]) => {
      const currentElement = xmlDocument.createElement(key);
      currentElement.textContent = value == null ? null : String(value);
      containerElement.appendChild(currentElement);
    });
    rootElement.appendChild(containerElement);
  });

  return new XMLSerializer().serializeToString(xmlDocument);
}

function parseAttribute(node: Element, name: string) {
  let content = node.querySelector(name)?.textContent || null;
  if (content !== null) {
    content = decodeURIComponent(content);
  }
  return content;
}

function parseArrayAttribute(node: Element, name: string) {
  return Array.from(node.querySelectorAll(name) || []);
}
