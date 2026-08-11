import { css } from '@emotion/react';
import { EmptyState, Icon, OpenRoadIllustration } from '@jetstream/ui';
import { FunctionComponent } from 'react';

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
      <EmptyState headline="Prepare a file to get started" illustration={<OpenRoadIllustration />}>
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
      </EmptyState>
      <h2 className="slds-text-heading_small slds-text-align_center slds-m-top_large slds-m-bottom_small">How it works</h2>
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
    </div>
  );
};

export default LoadRecordsMultiObjectEmptyState;
