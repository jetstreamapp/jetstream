import { setItemInLocalStorage } from '@jetstream/shared/ui-utils';
import { Announcement } from '@jetstream/types';
import { Alert } from '@jetstream/ui';
import { useState } from 'react';

interface UnverifiedEmailAlertProps {
  announcements: Announcement[];
}

const LS_KEY_PREFIX = 'announcement_dismissed_';

export function AnnouncementAlerts({ announcements }: UnverifiedEmailAlertProps) {
  if (!announcements || !announcements.length) {
    return null;
  }

  return (
    <>
      {announcements.map((announcement) => (
        <AnnouncementAlert key={announcement.id} announcement={announcement} />
      ))}
    </>
  );
}

export function AnnouncementAlert({ announcement }: { announcement: Announcement }) {
  const key = `${LS_KEY_PREFIX}${announcement.id}`;
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(key) === 'true');

  if (dismissed || !announcement || !announcement.id || !announcement.content) {
    return null;
  }

  return (
    <Alert
      type="warning"
      leadingIcon="warning"
      allowClose
      onClose={() => {
        setItemInLocalStorage(key, 'true');
        setDismissed(true);
      }}
    >
      <span className="text-bold">{announcement.title}:</span> {announcement.content}
    </Alert>
  );
}
