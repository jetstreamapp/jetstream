import { NOOP } from '@jetstream/shared/utils';
import { createContext } from 'react';
import { FilterContextProps, SelectedRowsContext, SubqueryContext } from './data-table-types';

// Used to ensure that renderers and filters can have access to global state
export const DataTableFilterContext = createContext<FilterContextProps>({
  filterSetValues: {},
  filters: {},
  updateFilter: NOOP,
});
export const DataTableSubqueryContext = createContext<SubqueryContext | undefined>(undefined);
export const DataTableSelectedContext = createContext<SelectedRowsContext>({ selectedRowIds: new Set() });
// Used to allow arbitrary data to be accessed by renderers
export const DataTableGenericContext = createContext<Record<string, any>>({});

// serverUrl, org, columnDefinitions, isTooling, google_apiKey, google_appId, google_clientId
