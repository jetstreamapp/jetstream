import { MutableRefObject, useEffect, useRef, useState } from 'react';

/**
 * Returns ref to attach to HTML element and the value is a boolean flag
 * T is any HTML element
 *
 * Example:
 * const [hoverRef, isHovered] = useHover<HTMLDivElement>();
 *
 * @returns
 */
export function useHover<T>(): [MutableRefObject<T | null>, boolean] {
  const [value, setValue] = useState<boolean>(false);
  const ref = useRef<T | null>(null);
  const handleMouseOver = (): void => setValue(true);
  const handleMouseOut = (): void => setValue(false);

  /* eslint-disable consistent-return */
  useEffect(() => {
    const node: any = ref.current;
    if (node) {
      node.addEventListener('mouseover', handleMouseOver);
      node.addEventListener('mouseout', handleMouseOut);
      return () => {
        node.removeEventListener('mouseover', handleMouseOver);
        node.removeEventListener('mouseout', handleMouseOut);
        setValue(false);
      };
    }
  }, [ref.current]);

  return [ref, value];
}
