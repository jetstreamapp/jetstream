/* eslint-disable @typescript-eslint/no-explicit-any */
import * as API from '@jetstream/api-interfaces';
import { DescribeGlobalResult, DescribeSObjectResult } from 'jsforce';
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import { handleRequest } from './core';

export async function describeGlobal(): Promise<DescribeGlobalResult> {
  return handleRequest(request.get('/api/describe'));
}

export async function describeSObject(SObject: string): Promise<DescribeSObjectResult> {
  return handleRequest(request.get(`/api/describe/${SObject}`));
}

export async function query<T = any>(query: string, isTooling = false): Promise<API.QueryResults<T>> {
  return handleRequest(request.post(`/api/query`).query({ isTooling }).send({ query }));
}
