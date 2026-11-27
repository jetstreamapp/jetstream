import { css } from '@emotion/react';
import { useDisposables } from '@jetstream/shared/ui-utils';
import { delay, getErrorMessage, unSanitizeXml } from '@jetstream/shared/utils';
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
  TreeItems,
} from '@jetstream/ui';
import { MonacoDiffEditor, MonacoEditor } from '@jetstream/ui-core';
import { useOperationAccess } from '@jetstream/ui/app-state';
import type { editor } from 'monaco-editor';
import { FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import ViewOrCompareMetadataEditorSummary from '../view-or-compare-metadata/ViewOrCompareMetadataEditorSummary';
import { FileItemMetadata } from '../view-or-compare-metadata/viewOrCompareMetadataTypes';
import { getEditorLanguage } from '../view-or-compare-metadata/viewOrCompareMetadataUtils';
import { isPermissionXmlType, normalizeMetadataContent } from '../view-or-compare-metadata/xmlNormalizer';
import { OrgAlignmentComponentItem, OrgAlignmentDeployDirection } from './orgAlignmentTypes';
import { isComponentDeployableInDirection } from './orgAlignmentUtils';

export interface OrgAlignmentDiffModalProps {
  component: OrgAlignmentComponentItem;
  sourceOrg: SalesforceOrgUi;
  targetOrg: SalesforceOrgUi;
  normalizePermissionXml: boolean;
  onNormalizePermissionXmlChange: (value: boolean) => void;
  onLoadComponentFiles: (component: OrgAlignmentComponentItem) => Promise<OrgAlignmentComponentItem>;
  onDeploySingle: (component: OrgAlignmentComponentItem, direction: OrgAlignmentDeployDirection) => void;
  onClose: () => void;
}

export const OrgAlignmentDiffModal: FunctionComponent<OrgAlignmentDiffModalProps> = ({
  component: initialComponent,
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

  const [component, setComponent] = useState<OrgAlignmentComponentItem>(initialComponent);
  const [loading, setLoading] = useState(!initialComponent.filesLoaded);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [hideUnchangedRegions, setHideUnchangedRegions] = useState(false);

  useEffect(() => {
    if (component.filesLoaded) {
      return;
    }
    let active = true;
    onLoadComponentFiles(component)
      .then((loaded) => {
        if (active) {
          setLoadError(null);
          setComponent(loaded);
          setSelectedFileIndex(0);
        }
      })
      .catch((ex) => {
        if (active) {
          setLoadError(getErrorMessage(ex));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [component, onLoadComponentFiles]);

  const activeFilePair = component.files[selectedFileIndex] || component.files[0] || null;
  const language = useMemo(() => {
    const fileProps = activeFilePair?.source || activeFilePair?.target;
    return fileProps ? getEditorLanguage(fileProps) : 'xml';
  }, [activeFilePair]);

  const sourceContent = useMemo(() => {
    if (!activeFilePair?.source?.content) {
      return '';
    }
    const raw = unSanitizeXml(activeFilePair.source.content);
    return normalizePermissionXml
      ? normalizeMetadataContent(raw, {
          metadataType: activeFilePair.source.type,
          fileName: activeFilePair.source.fileName,
          normalizePermissionXml: true,
        })
      : raw;
  }, [activeFilePair, normalizePermissionXml]);

  const targetContent = useMemo(() => {
    if (!activeFilePair?.target?.content) {
      return '';
    }
    const raw = unSanitizeXml(activeFilePair.target.content);
    return normalizePermissionXml
      ? normalizeMetadataContent(raw, {
          metadataType: activeFilePair.target.type,
          fileName: activeFilePair.target.fileName,
          normalizePermissionXml: true,
        })
      : raw;
  }, [activeFilePair, normalizePermissionXml]);

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
        </AutoFullHeightContainer>
      </div>
    </Modal>
  );
};

export default OrgAlignmentDiffModal;
