/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { manualRequest } from '@jetstream/shared/data';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { ManualRequestPayload, ManualRequestResponse, SalesforceApiHistoryRequest, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer } from '@jetstream/ui';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useRecoilState, useRecoilValue } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import { useAmplitude } from '../core/analytics';
import * as fromSalesforceApiHistory from './salesforceApi.state';
import SalesforceApiRequest from './SalesforceApiRequest';
import SalesforceApiResponse from './SalesforceApiResponse';
require('codemirror/theme/monokai.css');

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SalesforceApiProps {}

export const SalesforceApi: FunctionComponent<SalesforceApiProps> = () => {
  const isMounted = useRef(null);
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [results, setResults] = useState<ManualRequestResponse>(null);
  const [loading, setLoading] = useState(false);
  const [historyItems, setHistoryItems] = useRecoilState(fromSalesforceApiHistory.salesforceApiHistoryState);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  const onSubmit = useCallback(
    async (requestData: SalesforceApiHistoryRequest) => {
      const { url, method, headers, body } = requestData;
      setLoading(true);
      setResults(null);
      try {
        const request: ManualRequestPayload = {
          method,
          url: `${url.startsWith('/') ? url : `/${url}`}`,
          headers,
        };

        if (method !== 'GET') {
          request.body = body;
        }

        const results = await manualRequest(selectedOrg, request);
        setResults(results);
        fromSalesforceApiHistory
          .initSalesforceApiHistoryItem(selectedOrg, requestData, {
            status: results.status,
            statusText: results.statusText,
          })
          .then((updatedHistoryItems) => {
            setHistoryItems(updatedHistoryItems);
            trackEvent(ANALYTICS_KEYS.sfdcApi_Submitted, { success: true });
          })
          .catch((ex) => {
            logger.warn('[ERROR] Could not save history', ex);
            rollbar.error('Error saving apex history', ex);
          });
      } catch (ex) {
        setResults({
          error: true,
          errorMessage: 'An unknown error has occurred',
          headers: null,
          status: null,
          statusText: null,
        });
        fromSalesforceApiHistory
          .initSalesforceApiHistoryItem(selectedOrg, requestData)
          .then((updatedHistoryItems) => {
            setHistoryItems(updatedHistoryItems);
            trackEvent(ANALYTICS_KEYS.sfdcApi_Submitted, { success: false, error: ex.message });
          })
          .catch((ex) => {
            logger.warn('[ERROR] Could not save history', ex);
            rollbar.error('Error saving apex history', ex);
          });
      } finally {
        setLoading(false);
      }
    },
    [historyItems, selectedOrg, setHistoryItems, trackEvent]
  );

  return (
    <AutoFullHeightContainer fillHeight bottomBuffer={10} setHeightAttr className="slds-p-horizontal_x-small slds-scrollable_none">
      <Split
        sizes={[50, 50]}
        minSize={[300, 300]}
        gutterSize={10}
        className="slds-gutters"
        css={css`
          display: flex;
          flex-direction: row;
        `}
      >
        <div className="slds-p-horizontal_x-small">
          <SalesforceApiRequest selectedOrg={selectedOrg} defaultApiVersion={defaultApiVersion} loading={loading} onSubmit={onSubmit} />
        </div>
        <div className="slds-p-horizontal_x-small slds-is-relative">
          <SalesforceApiResponse loading={loading} results={results} />
        </div>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default SalesforceApi;
