import { css } from '@emotion/react';
import { useObservable } from '@jetstream/shared/ui-utils';
import { JetstreamEventStreamFilePayload } from '@jetstream/types';
import { useEffect, useState } from 'react';
import { Observable } from 'rxjs';
import { fromJetstreamEvents } from '../jetstream-events';

/**
 * This allows streaming a file download from the server.
 * Used when downloading query results from the Bulk API.
 */
export const DownloadFileStream = () => {
  const onDownloadFile = useObservable(
    fromJetstreamEvents.getObservable('streamFileDownload') as Observable<JetstreamEventStreamFilePayload>
  );
  const [activeDownloadLink, setActiveDownloadLink] = useState<JetstreamEventStreamFilePayload | null>(null);

  useEffect(() => {
    if (onDownloadFile && onDownloadFile.link) {
      setActiveDownloadLink(onDownloadFile);
    }
  }, [onDownloadFile]);

  if (!activeDownloadLink) {
    return null;
  }

  return (
    <a
      ref={(ref) => {
        if (ref) {
          ref.click();
          setActiveDownloadLink(null);
        }
      }}
      css={css`
        position: absolute;
        top: -100px;
        left: -100px;
        visibility: hidden;
      `}
      href={activeDownloadLink.link}
      rel="noopener noreferrer"
      download={activeDownloadLink.fileName}
    >
      Bulk API Download
    </a>
  );
};
