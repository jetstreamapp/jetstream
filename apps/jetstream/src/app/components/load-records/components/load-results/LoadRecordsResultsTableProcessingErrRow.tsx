/** @jsx jsx */
import { jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { Icon } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef } from 'react';
import { PrepareDataResponseError } from '../../load-records-types';

export interface LoadRecordsResultsTableProcessingErrRowProps {
  processingErrors: PrepareDataResponseError[];
  processingStartTime: string;
  processingEndTime: string;
  onDownload: () => void;
}

export const LoadRecordsResultsTableProcessingErrRow: FunctionComponent<LoadRecordsResultsTableProcessingErrRowProps> = ({
  processingErrors,
  processingStartTime,
  processingEndTime,
  onDownload,
}) => {
  const isMounted = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  const total = formatNumber(processingErrors.length);

  return (
    <tr className="slds-hint-parent">
      <th className="slds-is-relative" scope="row">
        <Icon
          type="utility"
          icon="error"
          description="Processing records failed"
          className="slds-icon slds-icon_small slds-icon-text-error slds-m-horizontal_xxx-small"
        />
      </th>
      <td>
        <div>
          <button className="slds-button" onClick={() => onDownload()}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            Download Failures
          </button>
        </div>
      </td>
      <td>{processingStartTime}</td>
      <td>{processingEndTime}</td>
      <td>
        <div className="slds-truncate" title={total}>
          {total}
        </div>
      </td>
      <td title={`Success: 0 / Failures: ${total}`}>
        <div>
          Failures: <span className="slds-truncate slds-text-color_error">{total}</span>
        </div>
      </td>
      <td>
        <div className="slds-truncate">Pre-processing failed</div>
      </td>
    </tr>
  );
};

export default LoadRecordsResultsTableProcessingErrRow;
