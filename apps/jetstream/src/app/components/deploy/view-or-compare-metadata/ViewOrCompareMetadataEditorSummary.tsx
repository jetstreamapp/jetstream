import { css } from '@emotion/react';
import { SalesforceOrgUi } from '@jetstream/types';
import { Badge, CopyToClipboard, Grid, TreeItems } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { EditorType, FileItemMetadata, FilePropertiesWithContent } from './viewOrCompareMetadataTypes';

export interface ViewOrCompareMetadataEditorSummaryProps {
  activeFile: TreeItems<FileItemMetadata>;
  editorType: EditorType;
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
}

const Content = ({ item, org, align }: { item: FilePropertiesWithContent; org: SalesforceOrgUi; align: 'left' | 'right' }) => {
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
}) => {
  return (
    <Grid
      className="slds-m-around_x-small"
      align="spread"
      verticalAlign="end"
      css={css`
        min-height: 2rem;
      `}
    >
      <div>
        {activeFile && (editorType === 'SOURCE' || editorType === 'DIFF') && (
          <Content item={activeFile.meta.source} org={sourceOrg} align="left" />
        )}
      </div>
      <div>
        {activeFile && (editorType === 'TARGET' || editorType === 'DIFF') && (
          <Content item={activeFile.meta.target} org={targetOrg} align="right" />
        )}
      </div>
    </Grid>
  );
};

export default ViewOrCompareMetadataEditorSummary;
