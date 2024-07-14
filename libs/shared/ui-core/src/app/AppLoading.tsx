import { Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef, useState } from 'react';

const delayMs = 300;

export const AppLoading: FunctionComponent = () => {
  const isMounted = useRef(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Only show loading if it takes longer than the delay
   * this keeps things from flashing in most cases
   */
  useEffect(() => {
    setTimeout(() => {
      if (isMounted.current) {
        setIsActive(true);
      }
    }, delayMs);
  }, []);

  return isActive ? <Spinner hasContainer={false} /> : null;
};

export default AppLoading;
