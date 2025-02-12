import browser from 'webextension-polyfill';
import type { ExternalIdentifier, TokenExchange } from '../utils/extension.types';

const targetOrigin = window.location.origin;

const EVENT_MAP = {
  ACKNOWLEDGE_RESPONSE: 'ACKNOWLEDGE_RESPONSE',
  ACKNOWLEDGE: 'ACKNOWLEDGE',
  EXT_IDENTIFIER_RESPONSE: 'EXT_IDENTIFIER_RESPONSE',
  EXT_IDENTIFIER: 'EXT_IDENTIFIER',
  TOKEN_EXCHANGE_RESPONSE: 'TOKEN_EXCHANGE_RESPONSE',
  TOKEN_EXCHANGE: 'TOKEN_EXCHANGE',
} as const;

window.addEventListener('message', async (event) => {
  if (event.origin !== targetOrigin) {
    return;
  }
  if (event.data?.message === EVENT_MAP.ACKNOWLEDGE) {
    window.postMessage({ message: EVENT_MAP.ACKNOWLEDGE_RESPONSE }, targetOrigin);
  } else if (event.data?.message === EVENT_MAP.EXT_IDENTIFIER) {
    try {
      const response = await browser.runtime.sendMessage<
        ExternalIdentifier['request'],
        { data: ExternalIdentifier['response'] } | { data: null; error: { error: true; message: string } }
      >({
        message: EVENT_MAP.EXT_IDENTIFIER,
      });
      if (!response.data) {
        window.postMessage({ message: 'ERROR', success: false, error: response.error }, targetOrigin);
        return;
      }
      window.postMessage({ message: EVENT_MAP.EXT_IDENTIFIER_RESPONSE, success: true, deviceId: response.data.deviceId }, targetOrigin);
    } catch (err) {
      console.error(err);
      window.postMessage({ message: 'ERROR', success: false, error: 'UNKNOWN_ERROR' }, targetOrigin);
    }
  } else if (event.data?.message === EVENT_MAP.TOKEN_EXCHANGE) {
    try {
      const response = await browser.runtime.sendMessage<
        TokenExchange['request'],
        { data: TokenExchange['response'] } | { data: null; error: { error: true; message: string } }
      >({
        message: EVENT_MAP.TOKEN_EXCHANGE,
        data: event.data.accessToken,
      });
      if (!response.data) {
        window.postMessage({ message: 'ERROR', success: false, error: response.error }, targetOrigin);
        return;
      }
      window.postMessage({ message: EVENT_MAP.TOKEN_EXCHANGE_RESPONSE, success: response.data.success }, targetOrigin);
    } catch (err) {
      console.error(err);
      window.postMessage({ message: 'ERROR', success: false, error: 'UNKNOWN_ERROR' }, targetOrigin);
    }
  }
});
