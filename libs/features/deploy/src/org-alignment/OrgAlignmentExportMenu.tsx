import { copyRecordsToClipboard } from '@jetstream/shared/ui-utils';
import { FileExtAllTypes, SalesforceOrgUi } from '@jetstream/types';
import { DropDown, FileDownloadModal, fireToast, Icon } from '@jetstream/ui';
import { fromJetstreamEvents } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import copyToClipboard from 'copy-to-clipboard';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, useState } from 'react';
import { OrgAlignmentExportContext, OrgAlignmentTypeResult } from './orgAlignmentTypes';
import {
  buildChangeReviewHtml,
  buildChangeReviewMarkdown,
  buildDriftReportFlatRows,
  buildDriftReportWorkbookData,
} from './orgAlignmentUtils';

const EXPORT_ACTION_XLSX = 'export-xlsx';
const EXPORT_ACTION_CSV = 'export-csv';
const EXPORT_ACTION_JSON = 'export-json';
const EXPORT_ACTION_COPY_MARKDOWN = 'export-copy-markdown';
const EXPORT_ACTION_COPY_HTML = 'export-copy-html';
const EXPORT_ACTION_COPY_EXCEL = 'export-copy-excel';
const EXPORT_ACTION_COPY_CSV = 'export-copy-csv';

/**
 * Copies rich text along with a plain text version for places that cannot accept formatted content.
 * Resolves to whether the copy landed, the clipboard is not always available (e.g. inside an iframe).
 */
async function copyRichTextToClipboard(html: string, plainText: string): Promise<boolean> {
  try {
    return await copyToClipboard(html, {
      format: 'text/html',
      onCopy: (clipboardData) => {
        if ('setData' in clipboardData) {
          clipboardData.setData('text/plain', plainText);
          return;
        }
        return new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        });
      },
    });
  } catch {
    return false;
  }
}

async function copyPlainTextToClipboard(text: string): Promise<boolean> {
  try {
    return await copyToClipboard(text, { format: 'text/plain' });
  } catch {
    return false;
  }
}

interface FileDownload {
  data: Record<string, unknown>[] | Record<string, unknown[]>;
  allowedTypes: FileExtAllTypes[];
  fileNameParts: string[];
}

export interface OrgAlignmentExportMenuProps {
  sourceOrg: SalesforceOrgUi | null;
  targetOrg: SalesforceOrgUi | null;
  typeResults: OrgAlignmentTypeResult[];
  /** When the comparison finished */
  generatedAt: Date | null;
  normalizePermissionXml: boolean;
  includeManaged: boolean;
  disabled: boolean;
}

/** Downloads the drift report as a file or copies it to the clipboard */
export const OrgAlignmentExportMenu: FunctionComponent<OrgAlignmentExportMenuProps> = ({
  sourceOrg,
  targetOrg,
  typeResults,
  generatedAt,
  normalizePermissionXml,
  includeManaged,
  disabled,
}) => {
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const [fileDownload, setFileDownload] = useState<FileDownload | null>(null);

  const canExport = Boolean(sourceOrg && targetOrg && typeResults.length > 0);

  async function handleExportAction(actionId: string) {
    if (!sourceOrg || !targetOrg || typeResults.length === 0) {
      return;
    }
    const context: OrgAlignmentExportContext = {
      sourceOrg,
      targetOrg,
      generatedAt: generatedAt ?? new Date(),
      normalizePermissionXml,
      includeManaged,
      typeResults,
    };
    const fileNameParts = ['org-alignment', context.sourceOrg.label, 'vs', context.targetOrg.label];
    // The menu closes without any other sign of whether something was copied
    const reportCopyResult = async (copied: 'Summary' | 'Components', copyResult: Promise<boolean>) => {
      if (await copyResult) {
        fireToast({ message: `${copied} copied to clipboard`, type: 'success' });
      } else {
        fireToast({ message: 'Unable to copy to the clipboard. Download the report instead.', type: 'error' });
      }
    };

    if (actionId === EXPORT_ACTION_XLSX) {
      setFileDownload({ data: buildDriftReportWorkbookData(context), allowedTypes: ['xlsx'], fileNameParts });
    } else if (actionId === EXPORT_ACTION_CSV) {
      setFileDownload({ data: buildDriftReportFlatRows(context, false), allowedTypes: ['csv'], fileNameParts });
    } else if (actionId === EXPORT_ACTION_JSON) {
      setFileDownload({ data: buildDriftReportFlatRows(context, false), allowedTypes: ['json'], fileNameParts });
    } else if (actionId === EXPORT_ACTION_COPY_MARKDOWN) {
      await reportCopyResult('Summary', copyPlainTextToClipboard(buildChangeReviewMarkdown(context)));
    } else if (actionId === EXPORT_ACTION_COPY_HTML) {
      await reportCopyResult('Summary', copyRichTextToClipboard(buildChangeReviewHtml(context), buildChangeReviewMarkdown(context)));
    } else if (actionId === EXPORT_ACTION_COPY_EXCEL) {
      await reportCopyResult('Components', copyRecordsToClipboard(buildDriftReportFlatRows(context, false), 'excel'));
    } else if (actionId === EXPORT_ACTION_COPY_CSV) {
      await reportCopyResult('Components', copyRecordsToClipboard(buildDriftReportFlatRows(context, false), 'csv'));
    }
  }

  return (
    <Fragment>
      {fileDownload && sourceOrg && (
        <FileDownloadModal
          org={sourceOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          modalHeader="Export Org Alignment Drift Report"
          data={fileDownload.data}
          fileNameParts={fileDownload.fileNameParts}
          allowedTypes={fileDownload.allowedTypes}
          escapeCsvFormulas
          onModalClose={() => setFileDownload(null)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      <DropDown
        className="slds-button_last"
        position="right"
        buttonClassName="slds-button slds-button_neutral"
        buttonContent={
          <span>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Export Report
          </span>
        }
        disabled={disabled || !canExport}
        items={[
          {
            id: EXPORT_ACTION_XLSX,
            subheader: 'Change-Review Exports',
            icon: { type: 'utility', icon: 'file' },
            value: 'Download Excel Workbook (.xlsx)',
          },
          {
            id: EXPORT_ACTION_CSV,
            icon: { type: 'utility', icon: 'download' },
            value: 'Download CSV (.csv)',
          },
          {
            id: EXPORT_ACTION_JSON,
            icon: { type: 'utility', icon: 'download' },
            value: 'Download JSON (.json)',
            trailingDivider: true,
          },
          {
            id: EXPORT_ACTION_COPY_MARKDOWN,
            icon: { type: 'utility', icon: 'copy_to_clipboard' },
            value: 'Copy Summary to Clipboard (Markdown)',
          },
          {
            id: EXPORT_ACTION_COPY_HTML,
            icon: { type: 'utility', icon: 'copy_to_clipboard' },
            value: 'Copy Summary to Clipboard (Rich Text)',
          },
          {
            id: EXPORT_ACTION_COPY_EXCEL,
            icon: { type: 'utility', icon: 'copy_to_clipboard' },
            value: 'Copy Components to Clipboard (Excel)',
          },
          {
            id: EXPORT_ACTION_COPY_CSV,
            icon: { type: 'utility', icon: 'copy_to_clipboard' },
            value: 'Copy Components to Clipboard (CSV)',
          },
        ]}
        onSelected={handleExportAction}
      />
    </Fragment>
  );
};

export default OrgAlignmentExportMenu;
