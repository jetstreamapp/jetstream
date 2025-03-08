import { BadgeTypes, HttpMethod } from '@jetstream/types';

export function getBadgeTypeFromMethod(method: HttpMethod): BadgeTypes {
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
