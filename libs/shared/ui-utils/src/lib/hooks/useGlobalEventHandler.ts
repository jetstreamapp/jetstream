import { useEffect } from 'react';

export function useGlobalEventHandler<K extends keyof (WindowEventMap & DocumentEventMap)>(
  event: K,
  handler: (event: (WindowEventMap & DocumentEventMap)[K]) => void,
  passive = false
) {
  useEffect(() => {
    window.addEventListener(event, handler, passive);
    return () => window.removeEventListener(event, handler);
  }, [event, handler, passive]);
}
