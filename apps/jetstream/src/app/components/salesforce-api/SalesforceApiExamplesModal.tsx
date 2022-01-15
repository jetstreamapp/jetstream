import { ColDef, RowNode } from '@ag-grid-community/core';
import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { salesforceApiReq } from '@jetstream/shared/data';
import { SalesforceApiRequest } from '@jetstream/types';
import { AutoFullHeightContainer, DataTable, Grid, Icon, Modal, Spinner } from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useAmplitude } from '../core/analytics';
import ErrorBoundaryFallback from '../core/ErrorBoundaryFallback';

const COLUMNS: ColDef[] = [
  {
    headerName: '',
    colId: 'execute',
    field: 'id',
    cellRenderer: 'executeRenderer',
    width: 120,
    filter: false,
    pinned: true,
    suppressMenu: true,
    lockPinned: true,
    lockPosition: true,
    lockVisible: true,
    sortable: false,
    resizable: false,
  },
  {
    headerName: 'Group',
    colId: 'groupName',
    field: 'groupName',
    tooltipField: 'groupDescription',
    width: 150,
    rowGroup: true,
    sortable: false,
    // lockVisible: true,
    // hide: true,
  },
  { headerName: 'Name', colId: 'name', field: 'name', tooltipField: 'description', width: 250 },
  { headerName: 'Method', colId: 'method', field: 'method', tooltipField: 'description', width: 110 },
  { headerName: 'url', colId: 'url', field: 'url', tooltipField: 'body', flex: 1 },
];

export interface SalesforceApiExamplesModalProps {
  onExecute: (request: SalesforceApiRequest) => void;
}

export const SalesforceApiExamplesModal: FunctionComponent<SalesforceApiExamplesModalProps> = ({ onExecute }) => {
  const isMounted = useRef(null);
  const { trackEvent } = useAmplitude();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<SalesforceApiRequest[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const requests = await salesforceApiReq();
      if (isMounted.current) {
        setIsLoading(false);
        setRequests(requests);
      }
    } catch (ex) {
      logger.warn('[SALESFORCE API] Error fetching requests');
      if (isMounted.current) {
        setIsLoading(false);
      }
      // TODO: handle error
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isLoading && !requests.length) {
      fetchRequests();
    }
  }, [isOpen]);

  function handleExecute(node: RowNode) {
    const request: SalesforceApiRequest = node.data;
    logger.info('[SALESFORCE API]', { request });
    onExecute(request);
    trackEvent(ANALYTICS_KEYS.sfdcApi_Sample, { group: request.groupName, name: request.name });
    setIsOpen(false);
  }

  function handleClose() {
    setIsOpen(false);
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <button className="slds-button" aria-hidden="true" tabIndex={-1} title="View samples API requests" onClick={() => setIsOpen(true)}>
        <Icon type="utility" icon="open_folder" className="slds-button__icon slds-button__icon_left" omitContainer />
        Library
        <span className="slds-assistive-text">View samples API requests modal</span>
      </button>
      {isOpen && (
        <Modal
          header="Sample API Requests"
          footer={
            <Grid align="spread" verticalAlign="center">
              <div>
                <a href="https://github.com/forcedotcom/postman-salesforce-apis" rel="noopener noreferrer" target="_blank">
                  View Salesforce Postman Collection
                </a>
              </div>
              <div>
                <button className="slds-button slds-button_neutral" onClick={handleClose}>
                  Close
                </button>
              </div>
            </Grid>
          }
          size="lg"
          onClose={handleClose}
        >
          <div
            className="slds-is-relative"
            css={css`
              min-height: 50vh;
            `}
          >
            {isLoading && <Spinner />}
            <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={250}>
              <DataTable
                columns={COLUMNS}
                data={requests}
                agGridProps={{
                  context: {
                    label: 'Use Request',
                    onClick: handleExecute,
                  },
                  autoGroupColumnDef: {
                    headerName: 'Group',
                    filter: 'agMultiColumnFilter',
                    menuTabs: ['filterMenuTab'],
                    sortable: true,
                    resizable: true,
                  },
                  sideBar: {
                    toolPanels: [
                      {
                        id: 'filters',
                        labelDefault: 'Filters',
                        labelKey: 'filters',
                        iconKey: 'filter',
                        toolPanel: 'agFiltersToolPanel',
                        toolPanelParams: {
                          suppressFilterSearch: true,
                        },
                      },
                      {
                        id: 'columns',
                        labelDefault: 'Columns',
                        labelKey: 'columns',
                        iconKey: 'columns',
                        toolPanel: 'agColumnsToolPanel',
                        toolPanelParams: {
                          suppressRowGroups: true,
                          suppressValues: true,
                          suppressPivots: true,
                          suppressPivotMode: true,
                        },
                      },
                    ],
                  },
                  showOpenedGroup: true,
                  groupDefaultExpanded: 1,
                  groupDisplayType: 'groupRows',
                  rowSelection: null,
                  immutableData: true,
                  getRowNodeId: (data: SalesforceApiRequest) => data.id,
                  tooltipMouseTrack: true,
                  tooltipShowDelay: 0,
                  copyHeadersToClipboard: false,
                }}
              />
            </AutoFullHeightContainer>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
};

export default SalesforceApiExamplesModal;
