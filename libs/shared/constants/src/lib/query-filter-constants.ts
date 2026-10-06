import type { QueryFilterOperator } from '@jetstream/types';

/**
 * Filter row function that turns a row into a `FORMULA('FieldA + FieldB') <operator> <value>` comparison (Winter '27 beta).
 */
export const FORMULA_FILTER_FUNCTION = 'FORMULA';

/** FORMULA() only supports plain comparisons, not LIKE, IN or NULL checks */
export const FORMULA_FILTER_OPERATORS: QueryFilterOperator[] = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte'];
