/* eslint-disable @typescript-eslint/no-explicit-any */
import * as API from '@jetstream/api-interfaces';
import { DescribeGlobalResult, DescribeSObjectResult } from 'jsforce';
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import { handleRequest } from './core';
import { SalesforceOrgUi, UserProfileUi, SobjectOperation, GenericRequestPayload } from '@jetstream/types';

//// LANDING PAGE ROUTES

export async function signUpNotify(email: string): Promise<DescribeGlobalResult> {
  return handleRequest(request.post('/landing/sign-up/notify').send({ email }));
}

//// APPLICATION ROUTES
export async function getUserProfile(): Promise<UserProfileUi> {
  return handleRequest(request.get('/api/me'));
}

export async function getOrgs(): Promise<SalesforceOrgUi[]> {
  return handleRequest(request.get('/api/orgs'));
}

export async function deleteOrg(org: SalesforceOrgUi): Promise<void> {
  return handleRequest(request.delete(`/api/orgs/${org.uniqueId}`));
}

export async function describeGlobal(org: SalesforceOrgUi): Promise<DescribeGlobalResult> {
  return handleRequest(request.get('/api/describe'), org).then((response: DescribeGlobalResult) => {
    if (response && Array.isArray(response.sobjects)) {
      response.sobjects.forEach((sobject) => {
        if (sobject.label.startsWith('__MISSING LABEL__')) {
          sobject.label = sobject.name;
        }
      });
    }
    return response;
  });
}

export async function describeSObject(org: SalesforceOrgUi, SObject: string): Promise<DescribeSObjectResult> {
  return handleRequest(request.get(`/api/describe/${SObject}`), org);
}

export async function query<T = any>(org: SalesforceOrgUi, query: string, isTooling = false): Promise<API.QueryResults<T>> {
  return handleRequest(request.post(`/api/query`).query({ isTooling }).send({ query }), org);
}

export async function queryMore<T = any>(org: SalesforceOrgUi, nextRecordsUrl: string, isTooling = false): Promise<API.QueryResults<T>> {
  return handleRequest(request.get(`/api/query-more`).query({ nextRecordsUrl, isTooling }), org);
}

export async function sobjectOperation<T = any>(
  org: SalesforceOrgUi,
  sobject: string,
  operation: SobjectOperation,
  body: {
    ids?: string | string[]; // required for retrieve | create | delete
    records?: any | any[]; // required for create | update | upsert
  },
  query: {
    externalId?: string;
    allOrNone?: boolean;
  } = {}
): Promise<T> {
  return handleRequest(request.post(`/api/record/${operation}/${sobject}`).query(query).send(body), org);
}

// TODO:
// export async function listMetadata<T = any>(org: SalesforceOrgUi, query: string, isTooling = false): Promise<API.QueryResults<T>> {
//   return handleRequest(request.post(`/api/query`).query({ isTooling }).send({ query }), org);
// }

export async function readMetadata<T = any>(org: SalesforceOrgUi, type: string, fullNames: string[]): Promise<T[]> {
  return handleRequest(request.post(`/api/metadata/read/${type}`).send({ fullNames }), org);
}

export async function genericRequest<T = any>(org: SalesforceOrgUi, payload: GenericRequestPayload): Promise<T> {
  return handleRequest(request.post(`/api/request`).send(payload), org);
}
