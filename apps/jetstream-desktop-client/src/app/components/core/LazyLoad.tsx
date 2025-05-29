/**
 * https://github.com/ianschmitz/react-lazy-with-preload
 * MIT License
 *
 * Copyright (c) 2019 Ian Schmitz
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { logErrorToRollbar } from '@jetstream/shared/ui-utils';
import { ComponentType, createElement, forwardRef, lazy } from 'react';

export type PreloadableComponent<T extends ComponentType<unknown>> = T & {
  preload: () => Promise<void>;
};

/**
 * Allow pre-loading modules before they are used
 *
 * General use-case is to load sub-modules (e.x. query results) since a user will likely need
 * it if they are on the query page
 *
 * @param componentImport
 * @returns
 */
export default function lazyWithPreload<T extends ComponentType<unknown>>(
  componentImport: () => Promise<{ default: T }>,
  moduleName = 'any'
): PreloadableComponent<T> {
  const LazyComponent = lazy(() => lazyRetry(componentImport, moduleName));
  let factoryPromise: Promise<void> | undefined;
  let LoadedComponent: T | undefined;

  const Component = forwardRef(function LazyWithPreload(props, ref) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createElement((LoadedComponent as any) ?? (LazyComponent as any), Object.assign(ref ? { ref } : {}, props) as any);
  }) as unknown as PreloadableComponent<T>;

  Component.preload = () => {
    if (!factoryPromise) {
      factoryPromise = componentImport()
        .then((module) => {
          LoadedComponent = module.default;
        })
        .catch((ex) => {
          console.error('Failed to preload component', ex);
          logErrorToRollbar('Preload route failed', {
            message: ex.message,
            stack: ex.stack,
          });
        });
    }

    return factoryPromise;
  };
  return Component;
}

/**
 * Retry loading a chunk to avoid chunk load error for out of date code
 * This wraps the react lazy function and will throw if a refresh fails to load a chunk a second time
 *
 * TODO: Review all pages of app and figure out if we can save users work.
 * e.x. dump recoil into local storage and reload/remove it on refresh (would require recoil-nexus)
 *
 * {@link https://www.codemzy.com/blog/fix-chunkloaderror-react}
 *
 * @param componentImport
 * @param name Optional name for component - this is only required if there are multiple lazy imports for one route
 */
const lazyRetry = <T extends ComponentType<unknown>>(
  componentImport: () => Promise<{ default: T }>,
  name = 'any'
): Promise<{ default: T }> => {
  return new Promise((resolve, reject) => {
    // check if the window has already been refreshed
    const hasRefreshed = JSON.parse(window.sessionStorage.getItem(`retry-${name}-refreshed`) || 'false');
    // try to import the component
    componentImport()
      .then((component) => {
        window.sessionStorage.setItem(`retry-${name}-refreshed`, 'false'); // success so reset the refresh
        resolve(component);
      })
      .catch((error) => {
        if (!hasRefreshed) {
          // not been refreshed yet
          window.sessionStorage.setItem(`retry-${name}-refreshed`, 'true');
          return window.location.reload();
        }
        // Default error behavior as already tried refreshing
        reject(error);
      });
  });
};
