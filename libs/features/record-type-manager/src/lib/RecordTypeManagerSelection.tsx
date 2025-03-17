import { css } from '@emotion/react';
import { useListMetadata } from '@jetstream/connected-ui';
import { logger } from '@jetstream/shared/client-logger';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import {
  AutoFullHeightContainer,
  Icon,
  ListWithFilterMultiSelect,
  Page,
  PageHeader,
  PageHeaderActions,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, fromRecordTypeManagerState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { getListItemFromRecordTypeMetadata } from './utils/record-types.utils';

const HEIGHT_BUFFER = 170;

export function RecordTypeManagerSelection() {
  const selectedOrg = useRecoilValue(selectedOrgState);

  const [recordTypes, setRecordTypes] = useRecoilState(fromRecordTypeManagerState.recordTypesState);
  const [selectedRecordTypeIds, setSelectedRecordTypeIds] = useRecoilState(fromRecordTypeManagerState.selectedRecordTypeIds);
  const hasSelectionsMade = useRecoilValue(fromRecordTypeManagerState.hasSelectionsMade);

  const { loadListMetadata, loading, listMetadataItems, hasError } = useListMetadata(selectedOrg);

  useEffect(() => {
    loadListMetadata([{ type: 'RecordType' }], { skipRequestCache: true });
  }, [loadListMetadata]);

  useEffect(() => {
    const recordTypes = listMetadataItems?.RecordType;
    if (recordTypes) {
      logger.info(recordTypes);
      setRecordTypes(getListItemFromRecordTypeMetadata(recordTypes.items));
    }
  }, [listMetadataItems?.RecordType, setRecordTypes]);

  async function handleRefresh() {
    setSelectedRecordTypeIds([]);
    await loadListMetadata([{ type: 'RecordType' }], { skipRequestCache: true });
  }

  return (
    <Page testId="record-type-manager-page">
      <RequireMetadataApiBanner />
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle
            icon={{ type: 'standard', icon: 'picklist_choice' }}
            label="Record Type Picklist Manager"
            docsPath={APP_ROUTES.RECORD_TYPE_MANAGER.DOCS}
          />
          <PageHeaderActions colType="actions" buttonType="separate">
            {hasSelectionsMade && (
              <Link className="slds-button slds-button_brand" to="editor">
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </Link>
            )}
            {!hasSelectionsMade && (
              <button className="slds-button slds-button_brand" disabled>
                Continue
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_right" />
              </button>
            )}
          </PageHeaderActions>
        </PageHeaderRow>
        <PageHeaderRow>
          <div
            className="slds-col_bump-left"
            css={css`
              min-height: 19px;
            `}
          >
            {!hasSelectionsMade && <span>Select one or more record types</span>}
          </div>
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer
        bottomBuffer={10}
        className="slds-p-horizontal_x-small slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        <div className="slds-p-horizontal_x-small">
          {hasError && <ScopedNotification theme="error">There was a problem communicating with Salesforce.</ScopedNotification>}
          <ListWithFilterMultiSelect
            labels={{
              listHeading: 'Record Types',
              filter: 'Filter Record Types',
              descriptorSingular: 'record type',
              descriptorPlural: 'record types',
            }}
            items={recordTypes}
            selectedItems={selectedRecordTypeIds}
            allowRefresh
            lastRefreshed={listMetadataItems?.RecordType?.lastRefreshed}
            loading={loading}
            onSelected={setSelectedRecordTypeIds}
            errorReattempt={handleRefresh}
            onRefresh={handleRefresh}
          />
        </div>
      </AutoFullHeightContainer>
    </Page>
  );
}
