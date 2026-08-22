import type { ElectronApiCallback, ElectronApiRequestResponse } from '@jetstream/desktop/types';
import { Page } from '@playwright/test';

type ElectronWindow = { electronAPI?: ElectronApiRequestResponse & ElectronApiCallback };

/**
 * Thin wrapper around `window.electronAPI` (the desktop app's preload-exposed IPC surface), driven
 * via `page.evaluate()` so calls go through the exact same path a real (or compromised) renderer
 * would use.
 *
 * Constructed per-`Page` rather than as a single fixture-locked instance, so tests can hold two
 * independent windows/senders (needed for anything probing per-window IPC state, e.g. the data
 * history stream ownership checks, which are keyed by `event.sender.id`).
 */
export class ElectronApiClient {
  constructor(private readonly page: Page) {}

  /**
   * Payload stays `unknown` on purpose (rather than the real parameter type) so an adversarial or
   * fuzz test can send a malformed payload without forking a parallel "unsafe" client. The return
   * type IS narrowed to the handler's real result, so call sites don't need a cast.
   */
  invoke<K extends keyof ElectronApiRequestResponse>(
    method: K,
    payload?: unknown,
  ): Promise<Awaited<ReturnType<ElectronApiRequestResponse[K]>>> {
    return this.page.evaluate(
      ({ method, payload }) => {
        const api = (window as unknown as ElectronWindow).electronAPI;
        if (!api) {
          throw new Error('window.electronAPI is not available on this page');
        }
        const fn = api[method as keyof typeof api] as (...args: unknown[]) => unknown;
        return payload === undefined ? fn() : fn(payload);
      },
      { method, payload },
      // The evaluated callback is typed `unknown` (it looks the handler up by string), so the
      // narrowing has to happen here. One cast in the client instead of one at every call site.
    ) as Promise<Awaited<ReturnType<ElectronApiRequestResponse[K]>>>;
  }

  /**
   * Some IPC methods (`login`, `addOrg`, `openGooglePicker`) resolve their `invoke` call with void
   * and deliver their real result later via a pushed `onX` event instead of the invoke's own
   * resolution — this waits for the next event on the given channel.
   */
  waitForEvent(channel: keyof ElectronApiCallback, timeoutMs = 15000): Promise<unknown> {
    return this.page.evaluate(
      ({ channel, timeoutMs }) =>
        new Promise((resolve, reject) => {
          const api = (window as unknown as ElectronWindow).electronAPI;
          if (!api) {
            reject(new Error('window.electronAPI is not available on this page'));
            return;
          }
          const onEvent = api[channel as keyof typeof api] as (cb: (payload: unknown) => void) => () => void;
          let unsubscribe: (() => void) | undefined;
          // `dispose` reads `unsubscribe` lazily rather than closing over a const: the listener
          // callback can in principle run before `onEvent` has returned, which would hit the
          // temporal dead zone if it referenced the binding directly.
          const dispose = () => {
            clearTimeout(timer);
            unsubscribe?.();
          };
          const timer = setTimeout(() => {
            dispose();
            reject(new Error(`Timed out waiting for ${String(channel)}`));
          }, timeoutMs);
          unsubscribe = onEvent((payload: unknown) => {
            dispose();
            resolve(payload);
          });
        }),
      { channel, timeoutMs },
    );
  }
}
