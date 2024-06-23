import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { salesforceApiReq } from '@jetstream/shared/data';
import { SalesforceApiRequest } from '@jetstream/types';
import { AutoFullHeightContainer, ColumnWithFilter, DataTree, Grid, Icon, Modal, setColumnFromType, Spinner } from '@jetstream/ui';
import { ErrorBoundaryFallback, useAmplitude } from '@jetstream/ui-core';
import groupBy from 'lodash/groupBy';
import { FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

const groupedRows = ['groupName'] as const;

export interface SalesforceApiExamplesModalProps {
  onExecute: (request: SalesforceApiRequest) => void;
}

export const SalesforceApiExamplesModal: FunctionComponent<SalesforceApiExamplesModalProps> = ({ onExecute }) => {
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const modalRef = useRef();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [requests, setRequests] = useState<SalesforceApiRequest[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState(new Set());

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
        setExpandedGroupIds(new Set(requests.map((item) => item.groupName)));
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

  const COLUMNS = useMemo(() => {
    const columns: ColumnWithFilter<SalesforceApiRequest>[] = [
      {
        ...setColumnFromType('groupName', 'text'),
        name: 'Group',
        key: 'groupName',
        width: 150,
      },
      {
        name: 'action',
        key: 'action',
        width: 150,
        draggable: true,
        renderCell: ({ row }) => {
          return (
            <button className={'slds-button slds-text-link_reset slds-text-link'} onClick={() => handleExecute(row)}>
              Use Request
            </button>
          );
        },
      },
      { ...setColumnFromType('name', 'text'), name: 'Name', key: 'name', width: 250, draggable: true },
      { ...setColumnFromType('method', 'text'), name: 'Method', key: 'method', width: 110, draggable: true },
      { ...setColumnFromType('url', 'text'), name: 'url', key: 'url', draggable: true /** flex: 1 */ },
    ];
    return columns;
  }, []);

  function handleExecute(request: SalesforceApiRequest) {
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
        Example API Endpoints
        <span className="slds-assistive-text">View samples API requests modal</span>
      </button>
      {isOpen && (
        <Modal
          ref={modalRef}
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
              <DataTree
                columns={COLUMNS}
                data={requests}
                getRowKey={(row: SalesforceApiRequest) => row.id}
                groupBy={groupedRows}
                rowGrouper={groupBy}
                expandedGroupIds={expandedGroupIds}
                onExpandedGroupIdsChange={(items) => setExpandedGroupIds(items)}
                context={{ portalRefForFilters: modalRef }}
              />
            </AutoFullHeightContainer>
          </div>
        </Modal>
      )}
    </ErrorBoundary>
  );
};

export default SalesforceApiExamplesModal;
