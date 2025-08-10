import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { RadioButton, RadioGroup, ScopedNotification, Spinner, Tree, TreeItems } from '@jetstream/ui';
import { OrgsCombobox } from '@jetstream/ui-core';
import { salesforceOrgsOmitSelectedState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { FileItemMetadata } from './viewOrCompareMetadataTypes';

export interface ViewOrCompareMetadataSidebarProps {
  editorType: 'SOURCE' | 'TARGET' | 'DIFF';
  files: TreeItems<FileItemMetadata | null>[] | null;
  targetOrg?: SalesforceOrgUi | null;
  targetLoading: boolean;
  hasSourceResults: boolean;
  hasTargetResults: boolean;
  sourceError?: Maybe<string>;
  targetError?: Maybe<string>;
  isChromeExtension: boolean;
  treeSettingsContent?: React.ReactNode;
  onEditorTypeChange: (value: 'SOURCE' | 'TARGET' | 'DIFF') => void;
  onSelectedFile: (item: TreeItems<FileItemMetadata>) => void;
  onTargetOrgChange: (org: SalesforceOrgUi) => void;
}

export const ViewOrCompareMetadataSidebar: FunctionComponent<ViewOrCompareMetadataSidebarProps> = ({
  editorType,
  files,
  targetOrg,
  targetLoading,
  hasSourceResults,
  hasTargetResults,
  sourceError,
  targetError,
  isChromeExtension,
  treeSettingsContent,
  onEditorTypeChange,
  onSelectedFile,
  onTargetOrgChange,
}) => {
  const orgs = useAtomValue(salesforceOrgsOmitSelectedState);

  function handleSelectedFile(item: TreeItems<FileItemMetadata>) {
    if (item.meta) {
      onSelectedFile(item);
    }
  }

  return (
    <>
      {!isChromeExtension && (
        <>
          <div className="slds-is-relative slds-m-bottom_x-small slds-m-right_x-small">
            {targetLoading && <Spinner />}
            <OrgsCombobox
              label="Compare metadata with different org"
              hideLabel={false}
              placeholder="Select an org"
              orgs={orgs}
              selectedOrg={targetOrg}
              disabled={targetLoading || !!sourceError}
              minWidth={0}
              onSelected={onTargetOrgChange}
            />
          </div>
          <div>
            <RadioGroup isButtonGroup>
              <RadioButton
                name="which-code"
                label="Source"
                value="SOURCE"
                checked={editorType === 'SOURCE'}
                disabled={!hasSourceResults || !!sourceError}
                onChange={(value) => onEditorTypeChange(value as 'SOURCE')}
              />
              <RadioButton
                name="which-code"
                label="target"
                value="TARGET"
                checked={editorType === 'TARGET'}
                disabled={!hasTargetResults || !!sourceError}
                onChange={(value) => onEditorTypeChange(value as 'TARGET')}
              />
              <RadioButton
                name="which-code"
                label="Compare"
                value="DIFF"
                checked={editorType === 'DIFF'}
                disabled={!hasSourceResults || !hasTargetResults || !!sourceError}
                onChange={(value) => onEditorTypeChange(value as 'DIFF')}
              />
            </RadioGroup>
          </div>
        </>
      )}
      {sourceError && (
        <ScopedNotification theme="error" className="slds-m-top_medium">
          There was an error getting metadata from the source org: {sourceError}
        </ScopedNotification>
      )}
      {targetError && (
        <ScopedNotification theme="error" className="slds-m-top_medium">
          There was an error getting metadata from the target org: {targetError}
        </ScopedNotification>
      )}
      {treeSettingsContent && !sourceError && !targetError && treeSettingsContent}
      {!!files?.length && (
        <Tree
          header="Metadata Files"
          items={files}
          expandAllOnInit
          onlyEmitOnLeafNodeClick
          selectFirstLeafNodeOnInit
          reEmitSelectionOnItemsChange
          onSelected={handleSelectedFile}
        />
      )}
    </>
  );
};

export default ViewOrCompareMetadataSidebar;
