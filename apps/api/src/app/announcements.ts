import { logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Announcement } from '@jetstream/types';

export function getAnnouncements(): Announcement[] {
  try {
    // This is a placeholder for the announcements that will be stored in the database eventually
    return [
      {
        id: 'auth-downtime-2024-11-15T15:00:00.000Z',
        title: 'Downtime',
        content:
          'We will be upgrading our authentication system with an expected start time of {start} in your local timezone. During this time, you will not be able to log in or use Jetstream. We expect the upgrade to take less than one hour.',
        replacementDates: [{ key: '{start}', value: '2024-11-16T18:00:00.000Z' }],
        expiresAt: '2024-11-16T19:45:11.373Z',
        createdAt: '2024-11-15T15:00:00.000Z',
      },
    ].filter(({ expiresAt }) => new Date(expiresAt) > new Date());
  } catch (ex) {
    logger.error({ ...getErrorMessageAndStackObj(ex) }, 'Failed to get announcements');
    return [];
  }
}
