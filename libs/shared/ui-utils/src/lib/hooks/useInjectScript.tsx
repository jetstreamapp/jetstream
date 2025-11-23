import { logger } from '@jetstream/shared/client-logger';
import { useEffect, useState } from 'react';

type stateTypes = {
  loaded: boolean;
  error: boolean;
};

// TODO: we might want to make sure we do not attempt to load the same script more than once!

/**
 * This is wrapped in a function to ensure that global state is not shared between usages
 *
 * Usage: const useInjectScript = getUseInjectScript('https://apis.google.com/js/api.js')
 * @param url: url of script to load
 * @returns
 */
export const getUseInjectScript = (url: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queue: any[] = [];
  let injector: 'init' | 'loading' | 'loaded' | 'error' = 'init';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let script: any = null;

  return function useInjectScript(): [boolean, boolean] {
    const [state, setState] = useState<stateTypes>({
      loaded: false,
      error: false,
    });

    useEffect(() => {
      // check if the script is already cached
      if (injector === 'loaded') {
        setState({
          loaded: true,
          error: false,
        });
        return;
      }

      // check if the script already errored
      if (injector === 'error') {
        setState({
          loaded: true,
          error: true,
        });
        return;
      }

      const onScriptEvent = (error: boolean) => {
        // Get all error or load functions and call them
        if (error) {
          logger.error('error loading the script', error);
        }
        queue.forEach((job) => job());

        if (error && script !== null) {
          script.remove();
          injector = 'error';
        } else {
          injector = 'loaded';
        }
      };

      const state = (error: boolean) => {
        setState({
          loaded: true,
          error,
        });
      };

      if (script === null) {
        script = document.createElement('script');
        script.src = url;
        script.async = true;
        // append the script to the body
        document.body.appendChild(script);
        script.addEventListener('load', () => onScriptEvent(false));
        script.addEventListener('error', () => onScriptEvent(true));
        injector = 'loading';
      }

      queue.push(state);

      // remove the event listeners
      return () => {
        //checks the main injector instance
        //prevents Cannot read property 'removeEventListener' of null in hot reload
        if (script) {
          script.removeEventListener('load', onScriptEvent);
          script.removeEventListener('error', onScriptEvent);
        }
      };
    }, []);

    return [state.loaded, state.error];
  };
};
