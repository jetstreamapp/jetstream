/* eslint-disable @typescript-eslint/no-explicit-any */
import * as API from '@jetstream/api-interfaces';
import { DescribeGlobalResult, DescribeSObjectResult } from 'jsforce';
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import { handleRequest } from './core';
import { SalesforceOrg, UserProfile, HttpMethod, SobjectOperation } from '@jetstream/types';

//// LANDING PAGE ROUTES

export async function signUpNotify(email: string): Promise<DescribeGlobalResult> {
  return handleRequest(request.post('/landing/sign-up/notify').send({ email }));
}

//// APPLICATION ROUTES
export async function getUserProfile(): Promise<UserProfile> {
  return handleRequest(request.get('/api/me'));
}

export async function describeGlobal(org: SalesforceOrg): Promise<DescribeGlobalResult> {
  return handleRequest(request.get('/api/describe'), org);
}

export async function describeSObject(org: SalesforceOrg, SObject: string): Promise<DescribeSObjectResult> {
  return handleRequest(request.get(`/api/describe/${SObject}`), org);
}

export async function query<T = any>(org: SalesforceOrg, query: string, isTooling = false): Promise<API.QueryResults<T>> {
  return handleRequest(request.post(`/api/query`).query({ isTooling }).send({ query }), org);
}

export async function sobjectOperation<T = any>(
  org: SalesforceOrg,
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

export async function genericRequest<T = any>(org: SalesforceOrg, method: HttpMethod, url: string, body?: any): Promise<T> {
  return handleRequest(request.post(`/api/request`).send({ method, url, body }), org);
}
