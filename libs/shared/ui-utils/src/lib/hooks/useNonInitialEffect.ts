import { NOOP } from '@jetstream/shared/utils';
import { DependencyList, EffectCallback, useEffect, useRef } from 'react';

/**
 * UseEffect hook that gets called when deps change, but will not be called on initial render
 *
 * https://medium.com/swlh/prevent-useeffects-callback-firing-during-initial-render-the-armchair-critic-f71bc0e03536
 *
 * @param effect
 * @param [deps]
 *
 * @example
 * ```
 * useNonInitialEffect(() => {
 *   console.log('Dependency changed!');
 * }, [dependency]);
 * ```
 *
 */
export function useNonInitialEffect(effect: EffectCallback, deps?: DependencyList) {
  const initialRender = useRef(true);

  useEffect(() => {
    let effectReturns: ReturnType<EffectCallback> = NOOP;
    if (initialRender.current) {
      initialRender.current = false;
    } else {
      effectReturns = effect();
    }

    if (effectReturns && typeof effectReturns === 'function') {
      return effectReturns;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
