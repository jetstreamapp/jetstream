import { ExpressionConditionType, ExpressionGroupType } from '@jetstream/types';

export function isExpressionConditionType(value: any): value is ExpressionConditionType {
  return !Array.isArray(value.rows);
}

export function isExpressionGroupType(value: any): value is ExpressionGroupType {
  return Array.isArray(value.rows);
}
