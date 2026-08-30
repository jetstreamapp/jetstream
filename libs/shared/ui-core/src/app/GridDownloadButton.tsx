import { buildGridExportData, ColumnWithFilter, FileDownloadModal, Icon, RowWithKey } from '@jetstream/ui';
import { applicationCookieState, googleDriveAccessState, selectedOrgState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { useMemo, useState } from 'react';
import { useAmplitude } from '../analytics';
import { fromJetstreamEvents } from '../jetstream-events';

export interface GridDownloadModalProps<T extends object = RowWithKey> {
  columns: ColumnWithFilter<T>[];
  /** Rows to export, in the order they should appear in the file (already sorted/grouped by the caller). */
  rows: readonly T[];
  /** Words combined into the download filename; org + timestamp are appended automatically. */
  fileNameParts: string[];
  /** Analytics source; defaults to the joined `fileNameParts`. */
  source?: string;
  modalHeader?: string;
  onClose: () => void;
}

/**
 * The standard {@link FileDownloadModal} wired to app state for any {@link ColumnWithFilter}-based grid.
 * Render it directly (instead of using {@link GridDownloadButton}) when the trigger lives inside a Modal
 * that must `hide` while the download modal is open — `hide` UNMOUNTS the modal's content, so the
 * download modal's state has to live in a component that stays mounted (the shared parent).
 */
export function GridDownloadModal<T extends object = RowWithKey>({
  columns,
  rows,
  fileNameParts,
  source,
  modalHeader = 'Download',
  onClose,
}: GridDownloadModalProps<T>) {
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(selectedOrgState);
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);

  const exportData = useMemo(() => buildGridExportData(columns, rows), [columns, rows]);

  if (!selectedOrg) {
    return null;
  }

  return (
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
      onModalClose={onClose}
    />
  );
}

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
 *
 * Do NOT place this inside a Modal that `hide`s itself while downloading — `hide` unmounts the footer
 * and this component's modal state with it. Render {@link GridDownloadModal} from the shared parent instead.
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
  const selectedOrg = useAtomValue(selectedOrgState);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
      {/* Only mounted once opened — for large grids this avoids flattening export rows the user never downloads */}
      {isModalOpen && (
        <GridDownloadModal
          columns={columns}
          rows={rows}
          fileNameParts={fileNameParts}
          source={source}
          modalHeader={modalHeader}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}

export default GridDownloadButton;
