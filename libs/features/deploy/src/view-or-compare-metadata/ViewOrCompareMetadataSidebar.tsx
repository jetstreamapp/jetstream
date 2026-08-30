import { formatNumber } from '@jetstream/shared/ui-utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, RadioButton, RadioGroup, ScopedNotification, Spinner, Tree, TreeItems } from '@jetstream/ui';
import { OrgsCombobox } from '@jetstream/ui-core';
import { salesforceOrgsOmitSelectedState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent, useMemo, useState } from 'react';
import { FileItemMetadata } from './viewOrCompareMetadataTypes';
import { countMetadataFiles, filterUnchangedFiles } from './viewOrCompareMetadataUtils';

export interface ViewOrCompareMetadataSidebarProps {
  editorType: 'SOURCE' | 'TARGET' | 'DIFF';
  files: TreeItems<FileItemMetadata | null>[] | null;
  targetOrg?: SalesforceOrgUi | null;
  targetLoading: boolean;
  hasSourceResults: boolean;
  hasTargetResults: boolean;
  sourceError?: Maybe<string>;
  targetError?: Maybe<string>;
  isSingleOrgMode: boolean;
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
  isSingleOrgMode,
  treeSettingsContent,
  onEditorTypeChange,
  onSelectedFile,
  onTargetOrgChange,
}) => {
  const orgs = useAtomValue(salesforceOrgsOmitSelectedState);
  const [hideUnchangedFiles, setHideUnchangedFiles] = useState(false);

  const allFiles = useMemo(() => files ?? [], [files]);
  const hasErrors = !!sourceError || !!targetError;
  // The filter is only meaningful once a target org has been compared - without comparison data every file reads as changed, so the toggle would do nothing
  const allowHideUnchangedFiles = hasTargetResults && !hasErrors;
  const isFilterActive = allowHideUnchangedFiles && hideUnchangedFiles;

  const visibleFiles = useMemo(() => (isFilterActive ? filterUnchangedFiles(allFiles) : allFiles), [allFiles, isFilterActive]);
  const visibleFileCount = useMemo(() => countMetadataFiles(visibleFiles), [visibleFiles]);
  const totalFileCount = useMemo(() => countMetadataFiles(allFiles), [allFiles]);

  function handleSelectedFile(item: TreeItems<FileItemMetadata>) {
    if (item.meta) {
      onSelectedFile(item);
    }
  }

  return (
    <>
      {!isSingleOrgMode && (
        <div className="slds-m-horizontal_x-small">
          <div className="slds-is-relative slds-m-bottom_x-small">
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
            <RadioGroup label="Metadata view" isButtonGroup>
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
                label="Target"
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
        </div>
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
      {allowHideUnchangedFiles && (
        <div className="slds-m-top_x-small slds-p-left_xx-small">
          <Checkbox
            id="hide-unchanged-files"
            label="Hide Unchanged Files"
            labelHelp="Only show metadata files that are different from or missing in the target org."
            checked={hideUnchangedFiles}
            onChange={setHideUnchangedFiles}
          />
        </div>
      )}
      {treeSettingsContent && !hasErrors && treeSettingsContent}
      {allowHideUnchangedFiles && (
        <div className="slds-text-body_small slds-text-color_weak slds-p-left_xx-small slds-m-bottom_x-small">
          Showing {formatNumber(visibleFileCount)} of {formatNumber(totalFileCount)} files
        </div>
      )}
      {!!totalFileCount && (
        <Tree
          header="Metadata Files"
          items={visibleFiles}
          expandAllOnInit
          onlyEmitOnLeafNodeClick
          selectFirstLeafNodeOnInit
          reEmitSelectionOnItemsChange
          onSelected={handleSelectedFile}
        />
      )}
      {isFilterActive && !!totalFileCount && !visibleFiles.length && (
        <ScopedNotification theme="light" className="slds-m-top_small">
          All metadata matches the target org.
        </ScopedNotification>
      )}
    </>
  );
};

export default ViewOrCompareMetadataSidebar;
