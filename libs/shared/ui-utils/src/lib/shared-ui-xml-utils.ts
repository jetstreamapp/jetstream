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
        recordType: parseAttribute(node, 'recordType'),
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
      fullName: parseAttribute(node, 'fullName'),
      active: ensureBoolean(parseAttribute(node, 'active')),
      label: parseAttribute(node, 'label'),
      picklistValues: parseArrayAttribute(node, 'picklistValues').map((values) => {
        return {
          picklist: parseAttribute(values, 'picklist'),
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

function parseAttribute(node: Element, name: string) {
  let content = node.querySelector(name)?.textContent || null;
  // FIXME: not sure if this is working
  if (content !== null) {
    content = decodeURIComponent(content);
  }
  return content;
}

function parseArrayAttribute(node: Element, name: string) {
  return Array.from(node.querySelectorAll(name) || []);
}
