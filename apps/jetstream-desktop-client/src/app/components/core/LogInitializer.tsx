import { enableLogger, logger } from '@jetstream/shared/client-logger';
import { FunctionComponent, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const URL_PARAM = 'logger';

function useLoggingQuery() {
  return new URLSearchParams(useLocation().search).get(URL_PARAM) || false;
}

export const LogInitializer: FunctionComponent = () => {
  const logging = useLoggingQuery();
  useEffect(() => {
    if (logging && !logger.isEnabled) {
      enableLogger(true);
    }
  }, [logging]);

  return null;
};

export default LogInitializer;
