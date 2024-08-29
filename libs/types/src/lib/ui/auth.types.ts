import type { useClerk } from '@clerk/clerk-react';

export type ClerkUser = NonNullable<ReturnType<typeof useClerk>['user']>;
