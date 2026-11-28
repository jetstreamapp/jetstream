import { css } from '@emotion/react';
import { useDisposables } from '@jetstream/shared/ui-utils';
import { delay, getErrorMessage } from '@jetstream/shared/utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Badge,
  Checkbox,
  DisabledReasonButton,
  Grid,
  Icon,
  Modal,
  ScopedNotification,
  Spinner,
  Tooltip,
  Tree,
  TreeItems,
} from '@jetstream/ui';
import { MonacoDiffEditor, MonacoEditor } from '@jetstream/ui-core';
import { useOperationAccess } from '@jetstream/ui/app-state';
import type { editor } from 'monaco-editor';
import { Fragment, FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import ViewOrCompareMetadataEditorSummary from '../view-or-compare-metadata/ViewOrCompareMetadataEditorSummary';
import { FileItemMetadata } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { getEditorLanguage } from '../view-or-compare-metadata/viewOrCompareMetadataUtils';
import { getDisplayContent, isPermissionXmlType } from '../view-or-compare-metadata/xmlNormalizer';
import { STATUS_LABELS } from './OrgAlignmentComponentsTable';
import { OrgAlignmentComponentItem, OrgAlignmentDeployDirection, OrgAlignmentDiffStatus } from './orgAlignmentTypes';
import { isComponentDeployableInDirection } from './orgAlignmentUtils';

const STATUS_TOOLTIPS: Record<OrgAlignmentDiffStatus, string> = {
  different: 'Source and Target org are different',
  onlyInSource: 'This item does not exist in the target org',
  onlyInTarget: 'This item does not exist in the source org',
  same: 'Source and Target org are the same',
  uncomparable: 'This item could not be compared',
};

/** Components grouped by metadata type, styled the same way as the file tree of View or Compare Metadata */
function getComponentTreeItems(components: OrgAlignmentComponentItem[]): TreeItems<string>[] {
  const treeItemsByType = new Map<string, TreeItems<string>>();
  for (const { key, type, typeLabel, fullName, status } of components) {
    const typeTreeItem = treeItemsByType.get(type) ?? { id: `TYPE|${type}`, label: typeLabel, title: typeLabel, treeItems: [] };
    treeItemsByType.set(type, typeTreeItem);
    typeTreeItem.treeItems?.push({
      id: key,
      title: fullName,
      meta: key,
      label: (
        <div className="slds-grid">
          <Tooltip id={`org-alignment-diff-tree-${key}`} content={STATUS_TOOLTIPS[status]}>
            <span className={status === 'same' ? 'slds-text-color_success' : 'slds-text-color_destructive'}>
              {fullName}
              {/* The status is otherwise colour and tooltip only */}
              <span className="slds-assistive-text"> ({STATUS_LABELS[status]})</span>
            </span>
          </Tooltip>
        </div>
      ),
    });
  }
  return Array.from(treeItemsByType.values());
}

export interface OrgAlignmentDiffModalProps {
  component: OrgAlignmentComponentItem;
  /** Set when several components are being viewed, they are listed in a tree next to the comparison */
  components?: OrgAlignmentComponentItem[];
  onSelectComponent?: (componentKey: string) => void;
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  normalizePermissionXml: boolean;
  onNormalizePermissionXmlChange: (value: boolean) => void;
  onLoadComponentFiles: (component: OrgAlignmentComponentItem) => Promise<OrgAlignmentComponentItem>;
  onDeploySingle: (component: OrgAlignmentComponentItem, direction: OrgAlignmentDeployDirection) => void;
  onClose: () => void;
}

export const OrgAlignmentDiffModal: FunctionComponent<OrgAlignmentDiffModalProps> = ({
  component,
  components,
  onSelectComponent,
  sourceOrg,
  targetOrg,
  normalizePermissionXml,
  onNormalizePermissionXmlChange,
  onLoadComponentFiles,
  onDeploySingle,
  onClose,
}) => {
  const deployAccess = useOperationAccess('metadata.deploy');
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const { addDisposable } = useDisposables();

  // The component is always the current one from the comparison results: its files arrive there once they are
  // retrieved, and its status follows the Normalize Permission XML setting
  const [shownComponentKey, setShownComponentKey] = useState(component.key);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [hideUnchangedRegions, setHideUnchangedRegions] = useState(false);
  const loading = !component.filesLoaded && !loadError;

  // Choosing another component reuses the open modal, so everything that belongs to the previous one is reset
  if (component.key !== shownComponentKey) {
    setShownComponentKey(component.key);
    setLoadError(null);
    setSelectedFileIndex(0);
  }

  const latestComponentRef = useRef(component);
  useEffect(() => {
    latestComponentRef.current = component;
  });

  // Only the key and whether the files are loaded matter here, the component itself is replaced whenever the
  // results change and its content must not be retrieved again each time
  useEffect(() => {
    if (component.filesLoaded) {
      return;
    }
    let active = true;
    onLoadComponentFiles(latestComponentRef.current).catch((ex) => {
      if (active) {
        setLoadError(getErrorMessage(ex));
      }
    });
    return () => {
      active = false;
    };
  }, [component.key, component.filesLoaded, onLoadComponentFiles]);

  const componentTreeItems = useMemo(() => (components && components.length > 1 ? getComponentTreeItems(components) : null), [components]);

  const activeFilePair = component.files[selectedFileIndex] || component.files[0] || null;
  const language = useMemo(() => {
    const fileProps = activeFilePair?.source || activeFilePair?.target;
    return fileProps ? getEditorLanguage(fileProps) : 'xml';
  }, [activeFilePair]);

  const sourceContent = useMemo(
    () => getDisplayContent(activeFilePair?.source, normalizePermissionXml),
    [activeFilePair, normalizePermissionXml],
  );
  const targetContent = useMemo(
    () => getDisplayContent(activeFilePair?.target, normalizePermissionXml),
    [activeFilePair, normalizePermissionXml],
  );

  const summaryTreeItem = useMemo<Maybe<TreeItems<FileItemMetadata>>>(() => {
    if (!activeFilePair) {
      return null;
    }
    const primary = activeFilePair.source || activeFilePair.target;
    if (!primary) {
      return null;
    }
    return {
      id: activeFilePair.fileName,
      label: activeFilePair.fileName,
      title: activeFilePair.fileName,
      meta: {
        type: component.type,
        filename: activeFilePair.fileName,
        source: activeFilePair.source as FileItemMetadata['source'],
        target: activeFilePair.target,
        targetHasLoaded: true,
        sourceAndTargetMatch: activeFilePair.matches,
      },
      treeItems: [],
    };
  }, [activeFilePair, component.type]);

  function toggleHideUnchangedRegions(ed: Maybe<editor.IStandaloneDiffEditor>) {
    ed?.updateOptions({ hideUnchangedRegions: { enabled: false } });
    delay(100).then(() => ed?.updateOptions({ hideUnchangedRegions: { enabled: true } }));
  }

  function handleDiffEditorMount(ed: editor.IStandaloneDiffEditor) {
    diffEditorRef.current = ed;
    addDisposable(
      ed.onDidUpdateDiff(() => {
        ed.revealPosition({ column: 1, lineNumber: 1 });
        if (hideUnchangedRegions) {
          toggleHideUnchangedRegions(ed);
        } else {
          const lineChanges = ed.getLineChanges();
          if (lineChanges?.length) {
            ed.revealLineInCenter(lineChanges[0].originalStartLineNumber);
          }
        }
      }),
    );
  }

  const canDeployAtoB = isComponentDeployableInDirection(component, 'A_TO_B');
  const canDeployBtoA = isComponentDeployableInDirection(component, 'B_TO_A');
  const isPermissionType = isPermissionXmlType(component.type, activeFilePair?.fileName);
  const showSingleEditor = component.status === 'onlyInSource' || component.status === 'onlyInTarget';

  const comparisonContent = (
    <Fragment>
      {component.files.length > 1 && (
        <div className="slds-p-horizontal_small slds-p-top_x-small slds-grid slds-wrap slds-gutters_xx-small">
          {component.files.map((filePair, index) => (
            <div key={filePair.fileName} className="slds-col slds-grow-none slds-m-bottom_xx-small">
              <button
                type="button"
                className={`slds-button ${index === selectedFileIndex ? 'slds-button_brand' : 'slds-button_neutral'}`}
                onClick={() => setSelectedFileIndex(index)}
              >
                <span>{filePair.fileName.split('/').pop()}</span>
                {!filePair.matches && !showSingleEditor && (
                  <Badge type="warning" className="slds-m-left_xx-small">
                    Diff
                  </Badge>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {loadError && (
        <ScopedNotification theme="error" className="slds-m-around_small">
          Could not retrieve metadata content: {loadError}
        </ScopedNotification>
      )}

      <ViewOrCompareMetadataEditorSummary
        activeFile={summaryTreeItem}
        sourceOrg={sourceOrg}
        targetOrg={targetOrg}
        editorType={showSingleEditor ? (component.status === 'onlyInSource' ? 'SOURCE' : 'TARGET') : 'DIFF'}
        swapped={swapped}
        onSwap={() => setSwapped((previous) => !previous)}
      />

      <div
        className="slds-is-relative"
        css={css`
          height: calc(100% - 4.5rem);
          min-height: 360px;
        `}
      >
        {loading && <Spinner />}
        {!loading && !loadError && showSingleEditor && (
          <MonacoEditor
            height="100%"
            language={language}
            options={{ readOnly: true, contextmenu: false }}
            value={component.status === 'onlyInSource' ? sourceContent : targetContent}
          />
        )}
        {!loading && !loadError && !showSingleEditor && (
          <MonacoDiffEditor
            key={`${activeFilePair?.fileName}-${swapped ? 'swapped' : 'original'}`}
            height="100%"
            language={language}
            keepCurrentModifiedModel
            keepCurrentOriginalModel
            options={{
              readOnly: true,
              contextmenu: false,
              renderSideBySide: true,
              useInlineViewWhenSpaceIsLimited: false,
            }}
            original={swapped ? targetContent : sourceContent}
            modified={swapped ? sourceContent : targetContent}
            onMount={handleDiffEditorMount}
          />
        )}
      </div>
    </Fragment>
  );

  return (
    <Modal
      header={`${component.typeLabel}: ${component.fullName}`}
      size="lg"
      footer={
        <Grid align="spread" verticalAlign="center" wrap>
          <Grid verticalAlign="center" wrap>
            {!showSingleEditor && (
              <Checkbox
                id="org-alignment-diff-hide-unchanged"
                className="slds-m-right_medium"
                label="Hide Unchanged Regions"
                checked={hideUnchangedRegions}
                onChange={(enabled) => {
                  setHideUnchangedRegions(enabled);
                  diffEditorRef.current?.updateOptions({ hideUnchangedRegions: { enabled } });
                  if (enabled) {
                    toggleHideUnchangedRegions(diffEditorRef.current);
                  }
                }}
              />
            )}
            {isPermissionType && (
              <Checkbox
                id="org-alignment-diff-normalize-xml"
                label="Normalize Permission XML"
                labelHelp="Sort Profile and Permission Set XML elements before comparing."
                checked={normalizePermissionXml}
                onChange={onNormalizePermissionXmlChange}
              />
            )}
          </Grid>
          <Grid>
            {canDeployAtoB && (
              <DisabledReasonButton
                className="slds-button slds-button_brand slds-m-right_x-small"
                disabled={!deployAccess.allowed}
                disabledReason={deployAccess.deniedReason}
                onClick={() => onDeploySingle(component, 'A_TO_B')}
              >
                <Icon type="utility" icon="forward" className="slds-button__icon slds-button__icon_left" omitContainer />
                Deploy to {targetOrg.label}
              </DisabledReasonButton>
            )}
            {canDeployBtoA && (
              <DisabledReasonButton
                className="slds-button slds-button_neutral slds-m-right_x-small"
                disabled={!deployAccess.allowed}
                disabledReason={deployAccess.deniedReason}
                onClick={() => onDeploySingle(component, 'B_TO_A')}
              >
                <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
                Deploy to {sourceOrg.label}
              </DisabledReasonButton>
            )}
            <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
              Close
            </button>
          </Grid>
        </Grid>
      }
      onClose={onClose}
    >
      <div
        className="slds-is-relative"
        css={css`
          margin: -0.75rem -0.25rem;
        `}
      >
        <AutoFullHeightContainer fillHeight bottomBuffer={180} setHeightAttr delayForSecondTopCalc className="slds-scrollable_none">
          {componentTreeItems ? (
            <Split
              sizes={[20, 80]}
              minSize={[100, 300]}
              css={css`
                display: flex;
                flex-direction: row;
                height: 100%;
              `}
            >
              <div
                css={css`
                  overflow: auto;
                `}
              >
                <Tree
                  header="Selected Components"
                  items={componentTreeItems}
                  expandAllOnInit
                  onlyEmitOnLeafNodeClick
                  selectFirstLeafNodeOnInit
                  onSelected={({ meta }) => meta && onSelectComponent?.(meta)}
                />
              </div>
              <div
                css={css`
                  height: 100%;
                  min-width: 0;
                `}
              >
                {comparisonContent}
              </div>
            </Split>
          ) : (
            comparisonContent
          )}
        </AutoFullHeightContainer>
      </div>
    </Modal>
  );
};

export default OrgAlignmentDiffModal;
