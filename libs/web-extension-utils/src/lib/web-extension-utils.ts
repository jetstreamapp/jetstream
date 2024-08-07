import { enableLogger } from '@jetstream/shared/client-logger';
import { createRoot } from 'react-dom/client';
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
  console.log('RESPONSE', response);
  if (response.error) {
    throw new Error(response.error.message);
  }
  return response.data;
}

export function initAndRenderReact(
  content: Parameters<ReturnType<typeof createRoot>['render']>[0],
  {
    elementId = 'app-container',
    enableLogging = true,
  }: {
    elementId?: string;
    enableLogging?: boolean;
  } = {
    elementId: 'app-container',
    enableLogging: true,
  }
) {
  // Logging
  enableLogging && enableLogger(true);
  // Render
  const container = document.getElementById(elementId);
  const root = createRoot(container!);
  root.render(content);
}

export async function sendMessage<T extends MessageRequest>(message: T): Promise<ResponseForRequest<T>> {
  try {
    return await chrome.runtime.sendMessage<T, MessageResponse<ResponseForRequest<T>>>(message).then(handleResponse);
  } catch (error) {
    console.error('Error sending message', error);
    throw error;
  }
}
