import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { CreateFieldsResults } from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import CreateFieldsDeployModalRow from '../CreateFieldsDeployModalRow';

export interface CreateFieldsDeployModalDeploymentProps {
  selectedOrg: SalesforceOrgUi;
  results: CreateFieldsResults[];
  serverUrl: string;
}

export const CreateFieldsDeployModalDeployment: FunctionComponent<CreateFieldsDeployModalDeploymentProps> = ({
  selectedOrg,
  results,
  serverUrl,
}) => {
  return (
    <table
      className="slds-table slds-table_cell-buffer slds-no-row-hover slds-table_bordered slds-table_fixed-layout"
      css={css`
        min-width: 650px;
      `}
    >
      <thead>
        <tr className="slds-line-height_reset">
          <th scope="col">
            <div className="slds-truncate" title="Field">
              Field
            </div>
          </th>
          <th
            scope="col"
            css={css`
              width: 150px;
            `}
          >
            <div className="slds-truncate" title="Status">
              Status
            </div>
          </th>
          <th
            scope="col"
            css={css`
              width: 125px;
            `}
          >
            <div className="slds-truncate" title="Field Creation">
              Field Creation
            </div>
          </th>
          <th
            scope="col"
            css={css`
              width: 125px;
            `}
          >
            <div className="slds-truncate" title="FLS">
              FLS
            </div>
          </th>
          <th
            scope="col"
            css={css`
              width: 125px;
            `}
          >
            <div className="slds-truncate" title="Page Layouts">
              Page Layouts
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        {results.map((result) => (
          <CreateFieldsDeployModalRow key={result.key} selectedOrg={selectedOrg} serverUrl={serverUrl} result={result} />
        ))}
      </tbody>
    </table>
  );
};

export default CreateFieldsDeployModalDeployment;
