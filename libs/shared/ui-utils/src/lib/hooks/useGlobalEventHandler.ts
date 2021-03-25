import { useEffect } from 'react';

export function useGlobalEventHandler<K extends keyof WindowEventMap>(
  event: K,
  handler: (event: WindowEventMap[K]) => void,
  passive = false
) {
  useEffect(() => {
    window.addEventListener(event, handler, passive);
    return () => window.removeEventListener(event, handler);
  }, [event, handler, passive]);
}
