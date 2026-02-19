import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { CopyToClipboard, Icon, ReadOnlyFormElement, ScopedNotification, SearchInput, Spinner } from '@jetstream/ui';
import { useEffect, useState } from 'react';
import '../sfdc-styles-shim.scss';
import { getApiClientFromHost } from '../utils/extension-generic-api-request.utils';

interface SfdcPageRecordQuickViewProps {
  sfHost: string;
  recordId: string;
  sobject: string;
  onClose?: () => void;
}

interface RecordField {
  apiName: string;
  value: unknown;
  displayValue: string;
}

export function SfdcPageRecordQuickViewButton({ sfHost, recordId, sobject, onClose }: SfdcPageRecordQuickViewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!recordId || !sobject) {
    return null;
  }

  return (
    <>
      {isOpen && <SfdcPageRecordQuickView sfHost={sfHost} recordId={recordId} sobject={sobject} onClose={() => setIsOpen(false)} />}
      <button className="slds-button slds-button_neutral slds-button_stretch" onClick={() => setIsOpen(true)}>
        Quick View Current Record
      </button>
    </>
  );
}

export function SfdcPageRecordQuickView({ sfHost, recordId, sobject, onClose }: SfdcPageRecordQuickViewProps) {
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordData, setRecordData] = useState<RecordField[] | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const searchTermDebounced = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (sfHost && recordId) {
      setLoading(true);
      setErrorMessage(null);

      getApiClientFromHost(sfHost)
        .then(async (apiConnection) => {
          const record = await apiConnection.sobject
            .recordOperation({ operation: 'retrieve', ids: [recordId], sobject })
            .then((response) => response[0]);

          // Transform record into fields array
          const fields: RecordField[] = orderObjectsBy(
            Object.entries(record)
              .filter(([key]) => key !== 'attributes')
              .map(([apiName, value]) => ({
                apiName,
                value,
                displayValue: formatFieldValue(value),
              })),
            ['apiName'],
          );

          setRecordData(fields);
          setLoading(false);
        })
        .catch((err) => {
          logger.error(err);
          setErrorMessage(`Failed to load record: ${err.message}`);
          setLoading(false);
        });
    }
  }, [sfHost, recordId, sobject]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.stopImmediatePropagation(); // Prevent other escape handlers from firing
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const filteredFields = recordData?.filter(
    (field) =>
      !searchTermDebounced ||
      field.apiName.toLowerCase().includes(searchTermDebounced.toLowerCase()) ||
      field.displayValue.toLowerCase().includes(searchTermDebounced.toLowerCase()),
  );

  return (
    <div
      css={css`
        position: fixed;
        bottom: 0;
        right: 0;
        width: 50%;
        max-height: 90vh;
        background: white;
        border: 1px solid #dddbda;
        border-radius: 0.25rem 0 0 0;
        box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        z-index: 9999;

        @media (max-width: 768px) {
          width: 100%;
        }
      `}
    >
      {/* Header */}
      <div
        className="slds-docked-composer__header slds-grid slds-shrink-none"
        css={css`
          align-items: center;
        `}
      >
        <div className="slds-media slds-media_center slds-no-space">
          <div className="slds-media__figure slds-m-right_x-small">
            <Icon type="utility" icon="record_alt" className="slds-icon slds-icon_small slds-icon-text-default" />
          </div>
          <div className="slds-media__body">
            <h2 className="slds-truncate">Record View</h2>
          </div>
        </div>
        <span className="slds-text-body_small slds-text-color_weak slds-m-left_x-small">
          <CopyToClipboard content={recordId} />
          {recordId}
        </span>
        <div className="slds-col_bump-left slds-shrink-none">
          {/* TODO: minimize/expand if we want to */}
          <button className="slds-button slds-button_icon slds-button_icon" title="Close" onClick={onClose}>
            <Icon type="utility" icon="close" className="slds-icon slds-icon-text-default slds-icon_x-small" />
          </button>
        </div>
      </div>

      <div
        className="slds-docked-composer__body"
        css={css`
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        `}
      >
        {/* Search */}
        <div
          css={css`
            padding: 0.75rem 1rem;
            border-bottom: 1px solid #dddbda;
          `}
        >
          <SearchInput
            id="field-search"
            className="w-100"
            placeholder="Filter fields by name or value..."
            value={searchTerm}
            onChange={(value) => setSearchTerm(value)}
          />
        </div>

        {/* Content */}
        <div
          css={css`
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem;
            padding-bottom: 3rem;
          `}
        >
          {loading && (
            <div
              css={css`
                display: flex;
                justify-content: center;
                padding: 2rem;
              `}
            >
              <Spinner />
            </div>
          )}

          {errorMessage && (
            <ScopedNotification theme="error" className="slds-m-vertical_medium">
              {errorMessage}
            </ScopedNotification>
          )}

          {!loading && filteredFields && filteredFields.length === 0 && (
            <p className="slds-text-align_center slds-m-vertical_medium slds-text-color_weak">No fields match your search</p>
          )}

          {!loading && filteredFields && filteredFields.length > 0 && (
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
              `}
            >
              {filteredFields.map((field) => (
                <ReadOnlyFormElement
                  key={field.apiName}
                  id={field.apiName}
                  label={field.apiName}
                  className="slds-p-bottom_x-small"
                  value={field.displayValue}
                  bottomBorder
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to format field values for display
function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}
