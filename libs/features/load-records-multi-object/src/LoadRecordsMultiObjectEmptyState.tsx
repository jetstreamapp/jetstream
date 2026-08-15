import { css } from '@emotion/react';
import { Icon } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import ExampleImage from './images/load-to-multiple-objects-example.png';

export interface LoadRecordsMultiObjectEmptyStateProps {
  templateUrl: string;
  onTemplateDownload: () => void;
}

const HOW_IT_WORKS: { icon: string; title: string; description: string }[] = [
  {
    icon: 'table',
    title: 'One worksheet per object',
    description: 'Cell B1 is the object, B2 the operation, B3 the external Id (upsert only). Headers go on row 5, records start on row 6.',
  },
  {
    icon: 'record',
    title: 'Every record gets a Reference Id',
    description: 'Column A holds a temporary name for each row. It must be unique across all worksheets and is never saved to Salesforce.',
  },
  {
    icon: 'link',
    title: 'Link records with {curly braces}',
    description: 'Wrap a header like {AccountId} to make a whole column reference other rows, or wrap a single cell value like {account1}.',
  },
  {
    icon: 'groups',
    title: 'Linked records form groups',
    description:
      'Each group saves as one all-or-nothing transaction, with up to 500 related records per group. Unrelated groups load independently.',
  },
];

/** Pre-upload teaching state: the template CTA plus the mental model the template file itself cannot show */
export const LoadRecordsMultiObjectEmptyState: FunctionComponent<LoadRecordsMultiObjectEmptyStateProps> = ({
  templateUrl,
  onTemplateDownload,
}) => {
  return (
    <div className="slds-m-top_medium">
      <div className="slds-text-align_center slds-m-bottom_medium">
        <h2 className="slds-text-heading_medium slds-m-bottom_x-small">Prepare a file to get started</h2>
        <a
          className="slds-button slds-button_brand"
          href={templateUrl}
          target="_blank"
          rel="noreferrer"
          download
          onClick={() => onTemplateDownload()}
        >
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" />
          Download Excel Template
        </a>
      </div>
      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          max-width: 72rem;
          margin: 0 auto;
        `}
      >
        {HOW_IT_WORKS.map(({ icon, title, description }, i) => (
          <div key={icon} className="slds-box slds-box_small">
            <div className="slds-media slds-media_center slds-m-bottom_x-small">
              <div className="slds-media__figure">
                <span className="slds-badge slds-badge_inverse">{i + 1}</span>
              </div>
              <div className="slds-media__body">
                <strong>{title}</strong>
              </div>
            </div>
            <p className="slds-text-body_small slds-text-color_weak">{description}</p>
          </div>
        ))}
      </div>
      <img
        src={ExampleImage}
        alt="Two worksheets side by side. Each has the object API name in cell B1, the operation in B2, column headers on row 5, and records from row 6. Column A holds a Reference Id for every record, and columns with a header wrapped in curly braces - {ParentId} and {AccountId} - hold the Reference Id of the record they are related to."
        css={css`
          display: block;
          max-width: 100%;
          width: 62rem;
          margin: 1rem auto;
        `}
      />
    </div>
  );
};

export default LoadRecordsMultiObjectEmptyState;
