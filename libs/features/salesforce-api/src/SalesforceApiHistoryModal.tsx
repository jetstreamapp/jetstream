import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { ApiHistoryItem, SalesforceApiHistoryRequest, SalesforceOrgUi, UpDown } from '@jetstream/types';
import { Badge, CopyToClipboard, Grid, GridCol, Icon, List, Modal, SearchInput } from '@jetstream/ui';
import { dexieDb } from '@jetstream/ui/db';
import { Editor } from '@monaco-editor/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createRef, useEffect, useState } from 'react';
import { HistoryWhichOrg } from './HistoryWhichOrg';
import { SalesforceApiHistoryEmptyState } from './SalesforceApiHistoryEmptyState';
import { getBadgeTypeFromMethod } from './salesforce-api.utils';

export type WhichOrgType = 'ALL' | 'SELECTED';

export interface SalesforceApiHistoryModalProps {
  selectedOrg: SalesforceOrgUi;
  onSubmit: (request: SalesforceApiHistoryRequest, doExecute: boolean) => void;
  onClose: () => void;
}

export const SalesforceApiHistoryModal = ({ selectedOrg, onSubmit, onClose }: SalesforceApiHistoryModalProps) => {
  const [whichOrg, setWhichOrg] = useState<WhichOrgType>('SELECTED');
  const [selectedItemKey, setSelectedItemKey] = useState<`api_${string}`>();
  const [filterValue, setFilterValue] = useState('');
  const ulRef = createRef<HTMLUListElement>();

  const historyItems = useLiveQuery(
    () =>
      dexieDb.api_request_history
        .orderBy('lastRun')
        .reverse()
        .filter((item) => whichOrg === 'ALL' || item.org === selectedOrg.uniqueId)
        .toArray(),
    [whichOrg, selectedOrg.uniqueId],
    [] as ApiHistoryItem[],
  );

  const selectedHistoryItem = useLiveQuery(
    () => (selectedItemKey ? dexieDb.api_request_history.get(selectedItemKey) : undefined),
    [selectedItemKey],
  );

  const [filteredHistoryItems, setFilteredHistoryItems] = useState(historyItems);

  useEffect(() => {
    if (historyItems?.length && !selectedItemKey) {
      setSelectedItemKey(historyItems[0].key);
    }
  }, [historyItems, selectedItemKey]);

  useEffect(() => {
    if (!filterValue && historyItems !== filteredHistoryItems) {
      setFilteredHistoryItems(historyItems);
    } else if (filterValue) {
      setFilteredHistoryItems(historyItems.filter(multiWordObjectFilter(['label'], filterValue)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyItems, filterValue]);

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  function handleSubmit(selectedHistoryItem: ApiHistoryItem['request']) {
    onSubmit(selectedHistoryItem, true);
    onClose();
    setWhichOrg('ALL');
  }

  function handleRestore(selectedHistoryItem: ApiHistoryItem['request']) {
    onSubmit(selectedHistoryItem, false);
    onClose();
    setWhichOrg('ALL');
  }

  function onModalClose() {
    onClose();
    setWhichOrg('ALL');
  }

  return (
    <Modal
      header="API History"
      className="slds-grow"
      tagline={
        <Grid align="spread" verticalAlign="center">
          <HistoryWhichOrg selectedOrg={selectedOrg} whichOrg={whichOrg} onChange={setWhichOrg} />
        </Grid>
      }
      size="lg"
      onClose={() => onModalClose()}
    >
      {historyItems.length <= 1 && <SalesforceApiHistoryEmptyState whichOrg={whichOrg} />}
      {historyItems.length > 1 && (
        <Grid className="slds-scrollable_y">
          <GridCol size={6} sizeMedium={4} className="slds-scrollable_y">
            <div className="slds-p-bottom--xx-small">
              <SearchInput
                id="query-history-object-filter"
                className="slds-p-around_xx-small"
                placeholder="Filter Requests"
                autoFocus
                value={filterValue}
                onChange={setFilterValue}
                onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {formatNumber(filteredHistoryItems.length)} of {formatNumber(historyItems.length)} objects
              </div>
            </div>
            <List
              ref={ulRef}
              items={filteredHistoryItems}
              isActive={(item: ApiHistoryItem) => item.key === selectedItemKey}
              subheadingPlaceholder
              onSelected={(key) => setSelectedItemKey(key as `api_${string}`)}
              getContent={(item: ApiHistoryItem) => ({
                key: item.key,
                heading: (
                  <Grid>
                    <Grid vertical className="slds-m-right_xx-small">
                      <div>
                        <Badge type={getBadgeTypeFromMethod(item.request.method)}>{item.request.method}</Badge>
                      </div>

                      <div className="slds-m-top_xx-small">
                        <Badge type={item.response.status >= 200 && item.response.status <= 299 ? 'success' : 'error'}>
                          {item.response?.status}
                        </Badge>
                      </div>
                    </Grid>
                    <p
                      css={css`
                        overflow-wrap: break-word;
                      `}
                      className="slds-line-clamp_small"
                    >
                      {item.request.url}
                    </p>
                  </Grid>
                ),
                subheading: item.lastRun?.toLocaleString(),
              })}
            />
          </GridCol>
          <GridCol className="slds-p-horizontal_x-small slds-scrollable_y">
            {selectedHistoryItem && (
              <div className="slds-is-relative slds-p-around_xx-small">
                <Grid align="spread" verticalAlign="center" wrap>
                  <div>
                    {selectedHistoryItem.response.status && (
                      <Badge
                        type={
                          selectedHistoryItem.response.status >= 200 && selectedHistoryItem.response.status <= 299 ? 'success' : 'error'
                        }
                      >
                        {selectedHistoryItem.response?.status} {selectedHistoryItem.response?.statusText}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <button className="slds-button slds-button_neutral" onClick={() => handleRestore(selectedHistoryItem.request)}>
                      <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Restore
                    </button>
                    <button className="slds-button slds-button_brand" onClick={() => handleSubmit(selectedHistoryItem.request)}>
                      <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Submit
                    </button>
                  </div>
                </Grid>
                <div className="slds-m-top_xx-small slds-grid">
                  <div>
                    <Badge type={getBadgeTypeFromMethod(selectedHistoryItem.request.method)}>{selectedHistoryItem.request.method}</Badge>
                  </div>
                  <div>
                    <CopyToClipboard content={selectedHistoryItem.request.url} className="slds-m-horizontal_xx-small" />
                  </div>
                  <span className="slds-line-clamp_large" title={selectedHistoryItem.request.url}>
                    {selectedHistoryItem.request.url}
                  </span>
                </div>
                <p className="slds-m-top_xx-small">Last executed at {selectedHistoryItem.lastRun?.toLocaleString()}</p>
                <h2 className="slds-text-heading_small slds-m-top_x-small">
                  Request Headers{' '}
                  <CopyToClipboard
                    content={JSON.stringify(selectedHistoryItem.request.headers || {}, null, 2)}
                    className="slds-m-horizontal_xx-small"
                  />
                </h2>
                <Editor
                  height="150px"
                  theme="vs-dark"
                  language="json"
                  value={JSON.stringify(selectedHistoryItem.request.headers || {}, null, 2)}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                  }}
                />
                {selectedHistoryItem.request.body && (
                  <>
                    <h2 className="slds-text-heading_small slds-m-top_small">
                      Request Body <CopyToClipboard content={selectedHistoryItem.request.body} className="slds-m-horizontal_xx-small" />
                    </h2>
                    <Editor
                      height="20vh"
                      theme="vs-dark"
                      language={selectedHistoryItem.request.bodyType === 'TEXT' ? 'plaintext' : 'json'}
                      value={selectedHistoryItem.request.body}
                      options={{
                        readOnly: true,
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </GridCol>
        </Grid>
      )}
    </Modal>
  );
};
