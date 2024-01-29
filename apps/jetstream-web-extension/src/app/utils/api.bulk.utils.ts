import { BulkApiCreateJobRequestPayload } from '@jetstream/types';
// import { create as xmlBuilder } from 'xmlbuilder2';

export function prepareBulkApiRequestPayload({
  type: _type,
  sObject,
  assignmentRuleId,
  serialMode,
  externalId,
  hasZipAttachment,
}: BulkApiCreateJobRequestPayload) {
  const type = _type === 'QUERY_ALL' ? 'queryAll' : _type.toLowerCase();

  // FIXME: xmlbuilder2 causes issue when used in service worker
  // // prettier-ignore
  // const jobInfoNode = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
  //   .ele('jobInfo', { xmlns: 'http://www.force.com/2009/06/asyncapi/dataload' })
  //     .ele('operation').txt(type).up()
  //   .ele('object').txt(sObject).up();

  // if (type === 'upsert' && externalId) {
  //   jobInfoNode.ele('externalIdFieldName').txt(externalId).up();
  // }

  // // job fails if these come before externalIdFieldName
  // // prettier-ignore
  // jobInfoNode.ele('concurrencyMode').txt(serialMode ? 'Serial' : 'Parallel').up();

  // if (hasZipAttachment) {
  //   jobInfoNode.ele('contentType').txt('ZIP_CSV').up();
  // } else {
  //   jobInfoNode.ele('contentType').txt('CSV').up();
  // }

  // // If this does not come last, Salesforce explodes
  // if (isString(assignmentRuleId) && assignmentRuleId) {
  //   jobInfoNode.ele('assignmentRuleId').txt(assignmentRuleId).up();
  // }

  // const xml = jobInfoNode.end({ prettyPrint: true });

  return 'xml';
}

export function prepareCloseOrAbortJobPayload(state: 'Closed' | 'Aborted' = 'Closed') {
  // prettier-ignore
  // return xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
  // .ele('jobInfo', { xmlns: 'http://www.force.com/2009/06/asyncapi/dataload' })
  //   .ele('state').txt(state).up()
  // .end({ prettyPrint: true });
  return '';
}
