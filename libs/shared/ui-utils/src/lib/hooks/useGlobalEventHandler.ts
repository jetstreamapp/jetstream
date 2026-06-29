import { useEffect } from 'react';

export function useGlobalEventHandler<K extends keyof (WindowEventMap & DocumentEventMap)>(
  event: K,
  handler: (event: (WindowEventMap & DocumentEventMap)[K]) => void,
  passive = false,
) {
  useEffect(() => {
    window.addEventListener(event, handler as EventListener, { passive });
    return () => window.removeEventListener(event, handler as EventListener);
  }, [event, handler, passive]);
}
