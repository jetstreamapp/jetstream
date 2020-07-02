import { genericRequest } from '@jetstream/shared/data';
import { SalesforceOrg } from '@jetstream/types';
import { Icon, Panel, Spinner, AutoFullHeightContainer } from '@jetstream/ui';
import { orderStringsBy } from '@jetstream/shared/utils';
import { Record } from 'jsforce';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { logger } from '@jetstream/shared/client-logger';
import { isObject, isNil, isBoolean } from 'lodash';
import classNames from 'classnames';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryResultsViewRecordFieldsProps {
  org: SalesforceOrg;
  row: Record<{ attributes: { type: string; url: string } }>;
  isOpen: boolean;
  onClosed: () => void;
}

function getValue(value: any) {
  if (isNil(value)) {
    return 'null';
  }
  if (isBoolean(value)) {
    return value ? 'TRUE' : 'FALSE';
  }
  if (isObject(value)) {
    return '-COMPLEX-';
  }
  return value;
}

export const QueryResultsViewRecordFields: FunctionComponent<QueryResultsViewRecordFieldsProps> = React.memo(
  ({ org, row, isOpen, onClosed }) => {
    const [recordData, setRecordData] = useState<string>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string>(null);

    useEffect(() => {
      let mounted = true;
      if (!isOpen && recordData) {
        setRecordData(null);
      }
      if (isOpen && org && row && !loading) {
        setLoading(true);
        setRecordData(null);
        setErrorMessage(null);
        // getRecordDetails();
        genericRequest(org, 'GET', row.attributes.url)
          .then((record) => {
            if (mounted) {
              setRecordData(record);
              setLoading(false);
            }
          })
          .catch((err) => {
            if (mounted) {
              logger.log('Error', err);
              setErrorMessage(err.message);
              setLoading(false);
            }
          });
      }
      return () => {
        logger.info('unmounted ;(');
        mounted = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, org, row]);

    // async function getRecordDetails() {
    //   // TODO: get metadata to show field type and label instead of (just) api name
    //   try {
    //     const record = await genericRequest(org, 'GET', row.attributes.url);
    //     setRecordData(record);
    //   } catch (ex) {
    //     logger.log('Error', ex);
    //     setErrorMessage(ex.message);
    //   } finally {
    //     setLoading(false);
    //   }
    // }

    return (
      <Panel heading={`Record Details`} isOpen={isOpen} size="lg" fullHeight={false} position="left" onClosed={onClosed}>
        <div>
          {loading && <Spinner />}
          {errorMessage && (
            <div className="slds-m-around_medium slds-box slds-text-color_error">
              <div className="slds-inline_icon_text slds-grid">
                <Icon
                  type="utility"
                  icon="error"
                  className="slds-icon slds-icon_x-small slds-m-right--small slds-icon-text-error"
                  containerClassname="slds-icon_container slds-icon-utility-error"
                />
                <div className="slds-col slds-align-middle">{errorMessage}</div>
              </div>
              <pre>
                <code>{errorMessage}</code>
              </pre>
            </div>
          )}
          {recordData && (
            <AutoFullHeightContainer className="slds-scrollable">
              <div className="slds-grid slds-wrap">
                {orderStringsBy(
                  Object.keys(recordData).filter((field) => field !== 'attributes' && getValue(recordData[field]) !== '-COMPLEX-')
                ).map((field: string) => {
                  const value = getValue(recordData[field]);
                  return (
                    <Fragment key={field}>
                      <div className="slds-col slds-size_1-of-2 slds-text-align_right slds-p-right_x-small">{field}</div>
                      <div
                        className={classNames('slds-col slds-size_1-of-2 slds-truncate', { 'slds-text-color_weak': value === 'null' })}
                        title={value}
                      >
                        {value}
                      </div>
                    </Fragment>
                  );
                })}
              </div>
            </AutoFullHeightContainer>
          )}
        </div>
      </Panel>
    );
  }
);

export default QueryResultsViewRecordFields;
