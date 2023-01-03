import { useCallback, useContext, useEffect } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';

/**
 * @source https://gist.github.com/MarksCode/64e438c82b0b2a1161e01c88ca0d0355
 * OLD SOURCE https://github.com/remix-run/react-router/commit/256cad70d3fd4500b1abcfea66f3ee622fb90874
 * OLD SOURCE https://github.com/remix-run/react-router/issues/8139#issuecomment-1023105785
 */
export function useConfirmExit(confirmExit: () => boolean, when = true) {
  const { navigator } = useContext(NavigationContext);

  useEffect(() => {
    if (!when) {
      return;
    }

    const push = navigator.push;

    navigator.push = (...args: Parameters<typeof push>) => {
      const result = confirmExit();
      if (result !== false) {
        push(...args);
      }
    };

    return () => {
      navigator.push = push;
    };
  }, [navigator, confirmExit, when]);
}

/**
 * @source https://gist.github.com/MarksCode/64e438c82b0b2a1161e01c88ca0d0355
 * OLD SOURCE https://github.com/remix-run/react-router/issues/8139#issuecomment-1021457943
 */
export function usePrompt(message: string, when = true) {
  const confirmExit = useCallback(() => {
    const confirm = window.confirm(message);
    return confirm;
  }, [message]);

  return useConfirmExit(confirmExit, when);
}
