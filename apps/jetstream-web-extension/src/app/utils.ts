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
  return response.data;
}

export async function sendMessage<T extends MessageRequest>(message: T): Promise<ResponseForRequest<T>> {
  try {
    return await chrome.runtime.sendMessage<T, MessageResponse<ResponseForRequest<T>>>(message).then(handleResponse);
  } catch (error) {
    console.error('Error getting salesforce host', error);
    throw error;
  }
}

// export async function getHost(url: string) {
//   try {
//     return await chrome.runtime
//       .sendMessage<GetSfHost['request'], MessageResponse<GetSfHost['response']>>({
//         message: 'GET_SF_HOST',
//         url,
//       })
//       .then(handleResponse);
//   } catch (error) {
//     console.error('Error getting salesforce host', error);
//     throw error;
//   }
// }

// export async function getSession(salesforceHost: string) {
//   try {
//     return await chrome.runtime
//       .sendMessage<GetSession['request'], MessageResponse<GetSession['response']>>({ message: 'GET_SESSION', salesforceHost })
//       .then(handleResponse);
//   } catch (error) {
//     console.error('Error getting session', error);
//     throw error;
//   }
// }

// export async function getPageUrl(page: string) {
//   try {
//     return await chrome.runtime
//       .sendMessage<GetPageUrl['request'], MessageResponse<GetPageUrl['response']>>({ message: 'GET_PAGE_URL', page })
//       .then(handleResponse);
//   } catch (error) {
//     console.error('Error getting session', error);
//     throw error;
//   }
// }

// export async function initOrg(sessionInfo: SessionInfo) {
//   try {
//     return await chrome.runtime
//       .sendMessage<InitOrg['request'], MessageResponse<InitOrg['response']>>({ message: 'INIT_ORG', sessionInfo })
//       .then(handleResponse);
//   } catch (error) {
//     console.error('Error getting session', error);
//     throw error;
//   }
// }
