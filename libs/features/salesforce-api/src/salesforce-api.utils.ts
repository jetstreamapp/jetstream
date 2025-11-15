import { BadgeType, HttpMethod } from '@jetstream/types';

export function getBadgeTypeFromMethod(method: HttpMethod): BadgeType {
  switch (method) {
    case 'GET':
      return 'light';
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return 'inverse';
    case 'DELETE':
      return 'error';
    default:
      return 'light';
  }
}
