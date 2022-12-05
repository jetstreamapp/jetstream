import { createContext } from 'react';
import { FilterContextProps, SelectedRowsContext, SubqueryContext } from './data-table-types';

// Used to ensure that renderers and filters can have access to global state
export const DataTableFilterContext = createContext<FilterContextProps>(undefined);
export const DataTableSubqueryContext = createContext<SubqueryContext>(undefined);
export const DataTableSelectedContext = createContext<SelectedRowsContext>(undefined);
// Used to allow arbitrary data to be accessed by renderers
export const DataTableGenericContext = createContext<Record<string, any>>({});
