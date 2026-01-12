import { logger } from '@jetstream/shared/client-logger';
import { useObservable } from '@jetstream/shared/ui-utils';
import { JetstreamEventStreamFilePayload } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { fromJetstreamEvents } from '@jetstream/ui-core';
import { useEffect } from 'react';
import { Observable } from 'rxjs';

/**
 * This allows streaming a file download from the server.
 * Used when downloading query results from the Bulk API.
 */
export const DownloadFileStreamDesktop = () => {
  const onDownloadFile = useObservable(
    fromJetstreamEvents.getObservable('streamFileDownload') as Observable<JetstreamEventStreamFilePayload>,
  );

  useEffect(() => {
    if (window.electronAPI && onDownloadFile && onDownloadFile.link) {
      window.electronAPI
        ?.downloadBulkApiFile(onDownloadFile)
        .then(() => {
          // TODO: show user list of recently saved files
        })
        .catch((err) => {
          logger.error('Error downloading Bulk API file', err);
          fireToast({ type: 'error', message: 'Error downloading Bulk API file' });
        });
    }
  }, [onDownloadFile]);

  return null;
};
