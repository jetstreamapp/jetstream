import { Maybe } from '@jetstream/types';

export async function getSession(sfHost: string) {
  const message = await new Promise((resolve) => chrome.runtime.sendMessage({ message: 'getSession', sfHost }, resolve));
  console.log('getSession', message);
  return message as Maybe<{ key: string; hostname: string }>;
}
