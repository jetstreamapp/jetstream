import { css } from '@emotion/react';
import { copyRecordsToClipboard, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, useState } from 'react';
import FileDownloadModal from '../file-download-modal/FileDownloadModal';
import EmptyState from '../illustrations/EmptyState';
import ReadonlyList from '../list/ReadonlyList';
import Modal from '../modal/Modal';
import ScopedNotification from '../scoped-notification/ScopedNotification';
import Icon from '../widgets/Icon';
import Spinner from '../widgets/Spinner';
import { MetadataDependency, useWhereIsThisUsed } from './useWhereIsThisUsed';

interface QueryWhereIsThisUsedProps {
  org: SalesforceOrgUi;
  sobject: string;
  field: string;
}

const CUSTOM_FIELD_SUFFIX = /__c/;

export const QueryWhereIsThisUsed: FunctionComponent<QueryWhereIsThisUsedProps> = ({ org, sobject, field }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [fieldName] = useState(() => field.replace(CUSTOM_FIELD_SUFFIX, ''));
  const [isFieldEligible] = useState(() => CUSTOM_FIELD_SUFFIX.test(field));
  const [exportData, setExportData] = useState<{ 'Reference Type': string; 'Reference Label': string; Namespace: string }[]>([]);

  const { loadDependencies, loading, items, hasLoaded, hasError, errorMessage } = useWhereIsThisUsed(org, sobject, fieldName);

  useNonInitialEffect(() => {
    if (isFieldEligible && isOpen && !hasLoaded) {
      loadDependencies();
    }
  }, [isFieldEligible, isOpen, items]);

  useNonInitialEffect(() => {
    if (items) {
      setExportData(
        items.map(({ meta }) => ({
          'Reference Type': meta?.MetadataComponentType || '',
          'Reference Label': meta?.MetadataComponentName || '',
          Namespace: meta?.MetadataComponentNamespace || '',
        }))
      );
    }
  }, [items]);

  function handleOpen() {
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleDownload() {
    setIsOpen(false);
    setExportModalOpen(true);
  }

  function handleCopyToClipboard() {
    copyRecordsToClipboard(exportData, 'excel', ['Reference Type', 'Reference Label', 'Namespace']);
  }

  return (
    <Fragment>
      {exportModalOpen && (
        <FileDownloadModal
          org={org}
          modalHeader="Download Field Dependencies"
          data={exportData}
          header={['Reference Type', 'Reference Label', 'Namespace']}
          fileNameParts={['dependencies', `${sobject}.${fieldName}`]}
          onModalClose={() => setExportModalOpen(false)}
        />
      )}
      {isFieldEligible && (
        <Fragment>
          {isOpen && (
            <Modal
              closeOnEsc
              closeOnBackdropClick
              onClose={handleClose}
              header="Where is this field used?"
              tagline={`${sobject}: ${field}`}
              footer={
                <div>
                  <button
                    className="slds-button slds-button_neutral"
                    onClick={handleCopyToClipboard}
                    disabled={!hasLoaded || loading || !items?.length}
                  >
                    Copy to Clipboard
                  </button>
                  <button
                    className="slds-button slds-button_neutral"
                    onClick={handleDownload}
                    disabled={!hasLoaded || loading || !items?.length}
                  >
                    Download
                  </button>
                  <button className="slds-button slds-button_brand" onClick={handleClose}>
                    Close
                  </button>
                </div>
              }
            >
              <div
                className="slds-is-relative"
                css={css`
                  min-height: 100px;
                `}
              >
                {loading && <Spinner />}
                {hasError && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}
                {hasLoaded && !loading && !hasError && (
                  <Fragment>
                    <p className="slds-text-color_weak slds-align_absolute-center">
                      Up to the first 2,000 dependencies are shown and Reports are not included.
                    </p>
                    <p className="slds-text-color_weak slds-align_absolute-center">
                      Dependencies may not be shown for standard objects, this is a Salesforce limitation.
                    </p>
                  </Fragment>
                )}
                {hasLoaded && !loading && !items?.length && !hasError && <EmptyState headline="No dependencies were found"></EmptyState>}
                <ReadonlyList
                  items={items || []}
                  getContent={(item: ListItem<string, MetadataDependency>) => ({
                    key: item.id,
                    id: item.id,
                    heading: item.label,
                    subheading: item.secondaryLabel,
                  })}
                />
              </div>
            </Modal>
          )}
          <div className="slds-hint-parent">
            <button className="slds-button slds-button_icon" title="Where is this field used?" onClick={handleOpen}>
              <Icon type="utility" icon="strategy" omitContainer className="slds-button__icon slds-button__icon_hint" />
            </button>
          </div>
        </Fragment>
      )}
    </Fragment>
  );
};

export default QueryWhereIsThisUsed;
