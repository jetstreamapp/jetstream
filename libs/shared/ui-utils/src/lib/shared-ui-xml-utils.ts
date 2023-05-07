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
        default: parseAttribute(node, 'default'),
        recordType: parseAttribute(node, 'recordType', 'boolean'),
        visible: parseAttribute(node, 'visible'),
      };
    }),
  };
}

export function parseRecordTypesFromCustomObject(xml: string) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xml, 'text/xml');
  return Array.from(xmlDoc.getElementsByTagName('recordTypes')).map((node) => {
    return {
      fullName: parseAttribute(node, 'fullName'),
      active: parseAttribute(node, 'active', 'boolean'),
      label: parseAttribute(node, 'label'),
      picklistValues: parseArrayAttribute(node, 'picklistValues').map((values) => {
        return {
          picklist: parseAttribute(values, 'picklist'),
          values: parseArrayAttribute(node, 'values').map((value) => {
            return {
              fullName: parseAttribute(value, 'fullName'),
              default: parseAttribute(value, 'default', 'boolean'),
            };
          }),
        };
      }),
    };
  });
}

function parseAttribute(node: Element, name: string, type: 'text' | 'boolean' = 'text') {
  let content = node.querySelector(name)?.textContent || null;
  // FIXME: not sure if this is working
  if (content !== null && type === 'text') {
    content = decodeURIComponent(content);
  }
  return type === 'boolean' ? content === 'true' : content;
}

function parseArrayAttribute(node: Element, name: string) {
  return Array.from(node.querySelectorAll(name) || []);
}
