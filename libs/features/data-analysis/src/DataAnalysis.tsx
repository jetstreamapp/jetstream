import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { FunctionComponent } from 'react';
import { Outlet } from 'react-router-dom';

/** Route shell for **Data analysis** (field usage). */
export const DataAnalysis: FunctionComponent = () => {
  useTitle(TITLES.DATA_ANALYSIS);
  return <Outlet />;
};

export default DataAnalysis;
