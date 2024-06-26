import { css } from '@emotion/react';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Badge, CopyToClipboard, Grid, Icon, Tooltip, TreeItems } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { EditorType, FileItemMetadata, FilePropertiesWithContent } from './viewOrCompareMetadataTypes';

export interface ViewOrCompareMetadataEditorSummaryProps {
  activeFile: Maybe<TreeItems<FileItemMetadata>>;
  editorType: EditorType;
  sourceOrg: Maybe<SalesforceOrgUi>;
  targetOrg: Maybe<SalesforceOrgUi>;
  swapped: boolean;
  onSwap: () => void;
}

const Content = ({
  item,
  org,
  align,
}: {
  item: Maybe<FilePropertiesWithContent>;
  org: Maybe<SalesforceOrgUi>;
  align: 'left' | 'right';
}) => {
  if (!item || !org) {
    return (
      <div>
        <Badge>Metadata does not exist in org</Badge>
      </div>
    );
  }
  return (
    <div>
      <div className={classNames({ 'slds-text-align_right': align === 'right' })} css></div>
      <div>
        <strong>Last Modified</strong> By {item.lastModifiedByName || 'unknown'} on {new Date(item.lastModifiedDate).toLocaleString()}
      </div>
      <div className={classNames({ 'slds-text-align_right': align === 'right' })}>
        {align === 'right' && <CopyToClipboard type="icon" content={item.content || ''} />}
        {org.label}
        {align === 'left' && <CopyToClipboard type="icon" content={item.content || ''} />}
      </div>
    </div>
  );
};

export const ViewOrCompareMetadataEditorSummary: FunctionComponent<ViewOrCompareMetadataEditorSummaryProps> = ({
  activeFile,
  editorType,
  sourceOrg,
  targetOrg,
  swapped,
  onSwap,
}) => {
  function getMetadataContent(which: EditorType, align: 'left' | 'right') {
    if (editorType !== 'DIFF' || !swapped) {
      if (which === 'SOURCE') {
        return <Content item={activeFile?.meta?.source} org={sourceOrg} align={align} />;
      }
      return <Content item={activeFile?.meta?.target} org={targetOrg} align={align} />;
    }
    // swapped
    if (which === 'SOURCE') {
      return <Content item={activeFile?.meta?.target} org={targetOrg} align={align} />;
    }
    return <Content item={activeFile?.meta?.source} org={sourceOrg} align={align} />;
  }

  return (
    <Grid
      className="slds-m-around_x-small"
      align="spread"
      verticalAlign="end"
      css={css`
        min-height: 2rem;
      `}
    >
      <div>{activeFile && (editorType === 'SOURCE' || editorType === 'DIFF') && getMetadataContent('SOURCE', 'left')}</div>
      {editorType === 'DIFF' && (
        <div>
          <Tooltip
            id={`deploy-compare-swap`}
            content="Swap source and target view. Sometimes it is easier to see the old state on the left and the changed state on the right when comparing a lower environment to a higher environment."
          >
            <button className="slds-button slds-button_icon" onClick={onSwap}>
              <Icon type="utility" icon="rotate" className="slds-button__icon slds-button__icon_large" omitContainer />
            </button>
          </Tooltip>
        </div>
      )}
      <div>{activeFile && (editorType === 'TARGET' || editorType === 'DIFF') && getMetadataContent('TARGET', 'right')}</div>
    </Grid>
  );
};

export default ViewOrCompareMetadataEditorSummary;
