import { buildGridExportData, ColumnWithFilter, FileDownloadModal, Icon, RowWithKey } from '@jetstream/ui';
import { applicationCookieState, googleDriveAccessState, selectedOrgState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { useAnalytics } from '../analytics';
import { fromJetstreamEvents } from '../jetstream-events';

export interface GridDownloadButtonProps<T extends object = RowWithKey> {
  columns: ColumnWithFilter<T>[];
  /** Rows to export, in the order they should appear in the file (already sorted/grouped by the caller). */
  rows: readonly T[];
  /** Words combined into the download filename; org + timestamp are appended automatically. */
  fileNameParts: string[];
  /** Analytics source; defaults to the joined `fileNameParts`. */
  source?: string;
  modalHeader?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Download button for any {@link ColumnWithFilter}-based grid. Opens the standard {@link FileDownloadModal}
 * (filename, format choice — Excel / CSV / JSON / Google Drive — and rename) wired to app state, so callers
 * only supply the grid's `columns` + `rows` (the same ones handed to the grid) and a filename. Grouping is
 * flattened; the caller controls ordering and which columns to include.
 */
export function GridDownloadButton<T extends object = RowWithKey>({
  columns,
  rows,
  fileNameParts,
  source,
  modalHeader = 'Download',
  label = 'Download',
  className,
  disabled,
}: GridDownloadButtonProps<T>) {
  const { trackEvent } = useAnalytics();
  const selectedOrg = useAtomValue(selectedOrgState);
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Only flatten the grid to export rows once the modal is actually opened — for large grids this avoids
  // doing the work on every render when the user never downloads.
  const exportData = useMemo(() => (isModalOpen ? buildGridExportData(columns, rows) : null), [isModalOpen, columns, rows]);

  return (
    <>
      <button
        type="button"
        className={classNames('slds-button slds-button_neutral', className)}
        disabled={disabled || rows.length === 0 || !selectedOrg}
        onClick={() => setIsModalOpen(true)}
      >
        <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
        {label}
      </button>
      {isModalOpen && selectedOrg && exportData && (
        <FileDownloadModal
          org={selectedOrg}
          modalHeader={modalHeader}
          data={exportData.data}
          header={exportData.header}
          fileNameParts={fileNameParts}
          source={source ?? fileNameParts.join('_')}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          trackEvent={trackEvent}
          onModalClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

export default GridDownloadButton;
