import { useEffect, useRef } from 'react';

/**
 * Combine multiple refs and return a single ref
 * This can be used in function components that have forwardRef but also need access to the ref
 *
 * {@link https://itnext.io/reusing-the-ref-from-forwardref-with-react-hooks-4ce9df693dd}
 *
 * @param refs
 * @returns
 */
export function useCombinedRefs<T extends HTMLElement>(...refs: (React.ForwardedRef<T> | React.MutableRefObject<T>)[]) {
  const targetRef = useRef<T>(null);

  useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) {
        return;
      }

      if (typeof ref === 'function') {
        ref(targetRef.current);
      } else {
        ref.current = targetRef.current;
      }
    });
  }, [refs]);

  return targetRef;
}
