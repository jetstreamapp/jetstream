/* eslint-disable @typescript-eslint/no-explicit-any */
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import * as API from '@jetstream/api-interfaces';

export async function handleRequest<T = any>(currRequest: request.SuperAgentRequest) {
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
