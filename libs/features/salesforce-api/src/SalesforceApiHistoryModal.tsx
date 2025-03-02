import { css } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { ApiHistoryItem, SalesforceApiHistoryRequest, SalesforceOrgUi, UpDown } from '@jetstream/types';
import { Grid, GridCol, Icon, List, Modal, SearchInput } from '@jetstream/ui';
import { dexieDb } from '@jetstream/ui/db';
import { Editor } from '@monaco-editor/react';
import classNames from 'classnames';
import { useLiveQuery } from 'dexie-react-hooks';
import { createRef, FunctionComponent, useEffect, useState } from 'react';
import HistoryWhichOrg from './HistoryWhichOrg';
import SalesforceApiHistoryEmptyState from './SalesforceApiHistoryEmptyState';

export type WhichOrgType = 'ALL' | 'SELECTED';

export interface SalesforceApiHistoryModalProps {
  selectedOrg: SalesforceOrgUi;
  onSubmit: (request: SalesforceApiHistoryRequest, doExecute: boolean) => void;
  onClose: () => void;
}

export const SalesforceApiHistoryModal: FunctionComponent<SalesforceApiHistoryModalProps> = ({ selectedOrg, onSubmit, onClose }) => {
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
    [] as ApiHistoryItem[]
  );

  const selectedHistoryItem = useLiveQuery(
    () => (selectedItemKey ? dexieDb.api_request_history.get(selectedItemKey) : undefined),
    [selectedItemKey]
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
                  <p
                    css={css`
                      overflow-wrap: break-word;
                    `}
                    className="slds-line-clamp_small"
                  >
                    {item.request.method} {item.request.url}
                  </p>
                ),
                subheading: item.lastRun?.toLocaleString(),
              })}
            />
          </GridCol>
          <GridCol className="slds-p-horizontal_x-small slds-scrollable_y">
            {selectedHistoryItem && (
              <div className="slds-is-relative slds-p-around_xx-small">
                <Grid align="end">
                  <button className="slds-button slds-button_neutral" onClick={() => handleRestore(selectedHistoryItem.request)}>
                    <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Restore
                  </button>
                  <button className="slds-button slds-button_brand" onClick={() => handleSubmit(selectedHistoryItem.request)}>
                    <Icon type="utility" icon="apex" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Submit
                  </button>
                </Grid>
                {selectedHistoryItem.response.status && (
                  <div>
                    <p
                      className={classNames({
                        'slds-text-color_success': selectedHistoryItem.response.status >= 200 && selectedHistoryItem.response.status <= 299,
                        'slds-text-color_error': selectedHistoryItem.response.status < 200 || selectedHistoryItem.response.status > 299,
                      })}
                    >
                      {selectedHistoryItem.response?.status} {selectedHistoryItem.response?.statusText}
                    </p>
                    <p>
                      <span className="slds-m-right_x-small">{selectedHistoryItem.request.method}</span>
                      <span className="slds-truncate" title={selectedHistoryItem.request.url}>
                        {selectedHistoryItem.request.url}
                      </span>
                    </p>
                  </div>
                )}
                <h2 className="slds-text-heading_small slds-m-top_x-small">Request Headers</h2>
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
                    <h2 className="slds-text-heading_small slds-m-top_small">Request Body</h2>
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

export default SalesforceApiHistoryModal;
