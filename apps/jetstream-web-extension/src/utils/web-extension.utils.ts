import { logger } from '@jetstream/shared/client-logger';
import { createRoot } from 'react-dom/client';
import browser from 'webextension-polyfill';
import { Message, MessageRequest, MessageResponse } from './extension.types';

type RequestResponseMap = {
  [K in Message as K['request']['message']]: K;
};

// Helper type to extract the appropriate response type based on a given request type
type ResponseForRequest<R> = R extends { message: infer M }
  ? M extends keyof RequestResponseMap
    ? RequestResponseMap[M]['response']
    : never
  : never;

function handleResponse<T>(response: MessageResponse<ResponseForRequest<T>>) {
  logger.log('RESPONSE', response);
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export function initAndRenderReact(
  content: Parameters<ReturnType<typeof createRoot>['render']>[0],
  { elementId = 'app-container' }: { elementId?: string } = { elementId: 'app-container' }
) {
  // Render
  const container = document.getElementById(elementId);
  const root = createRoot(container!);
  root.render(content);
}

export async function sendMessage<T extends MessageRequest>(message: T): Promise<ResponseForRequest<T>> {
  try {
    return await browser.runtime.sendMessage<T, MessageResponse<ResponseForRequest<T>>>(message).then(handleResponse);
  } catch (error) {
    logger.error('Error sending message', error);
    throw error;
  }
}

const is15or18Digits = /[a-z0-9]{15}|[a-z0-9]{18}/i;
const is18Digits = /[a-z0-9]{18}/i;

function isValidSalesforceRecordId(recordId?: string, allow15Char = true): boolean {
  const regex = allow15Char ? is15or18Digits : is18Digits;
  if (!recordId || !regex.test(recordId)) {
    return false;
  }
  if (recordId.length === 15 && allow15Char) {
    // no way to completely validate this
    return true;
  }
  const upperCaseToBit = (char: string) => (char.match(/[A-Z]/) ? '1' : '0');
  const binaryToSymbol = (digit: number) => (digit <= 25 ? String.fromCharCode(digit + 65) : String.fromCharCode(digit - 26 + 48));

  const parts = [
    recordId.slice(0, 5).split('').reverse().map(upperCaseToBit).join(''),
    recordId.slice(5, 10).split('').reverse().map(upperCaseToBit).join(''),
    recordId.slice(10, 15).split('').reverse().map(upperCaseToBit).join(''),
  ];

  const check = parts.map((str) => binaryToSymbol(parseInt(str, 2))).join('');

  return check === recordId.slice(-3);
}

export function getRecordPageRecordId(pathName: string) {
  let recordId: string | undefined;
  if (/\/[a-z0-9_]+\/[a-z0-9]{18}\/view$/i.test(pathName)) {
    // extract the record id by matching [a-zA-Z0-9]{18}
    recordId = pathName.match(/[a-zA-Z0-9]{18}/i)?.[0];
  } else if (/^\/[a-zA-Z0-9]{15}$/.test(pathName)) {
    recordId = pathName.match(/\/[a-z0-9]{15}$/i)?.[0];
  }
  if (isValidSalesforceRecordId(recordId)) {
    return recordId;
  }
  return recordId;
}
