/* eslint-disable @typescript-eslint/no-explicit-any */
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import { DescribeGlobalResult, DescribeSObjectResult } from 'jsforce';
import * as API from '@silverthorn/api-interfaces';

async function handleRequest<T = any>(currRequest: request.SuperAgentRequest) {
  try {
    console.log(`[HTTP][REQUEST][${currRequest.method}]`, currRequest.url, { request: currRequest });
    const response = await currRequest;
    console.log(`[HTTP][RESPONSE][${currRequest.method}][${response.status}]`, currRequest.url, { response: response.body });
    const body: API.RequestResult<T> = response.body;
    return body.data;
  } catch (ex) {
    console.log('[HTTP][RESPONSE][ERROR]', { exception: ex });
    const response: request.Response = ex.response;
    const message = response?.body?.data?.error?.message || 'An unknown error has occurred';
    throw new Error(message);
  }
}

// TODO: find out nice error handling pattern

export async function describeGlobal(): Promise<DescribeGlobalResult> {
  return handleRequest(request.get('/api/describe'));
}

export async function describeSObject(SObject: string): Promise<DescribeSObjectResult> {
  return handleRequest(request.get(`/api/describe/${SObject}`));
}

export async function query<T = any>(query: string, isTooling = false): Promise<API.QueryResults<T>> {
  return handleRequest(request.post(`/api/query`).query({ isTooling }).send({ query }));
}
