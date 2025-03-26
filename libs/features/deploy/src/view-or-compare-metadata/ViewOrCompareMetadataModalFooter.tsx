import { Grid, Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { OrgType } from './viewOrCompareMetadataTypes';

export interface ViewOrCompareMetadataModalFooterProps {
  hasSourceMetadata: boolean;
  hasTargetMetadata: boolean;
  hasTargetMetadataContent: boolean;
  sourceLoading: boolean;
  sourceLastChecked: Date | null;
  targetLoading: boolean;
  targetLastChecked: Date | null;
  isChromeExtension: boolean;
  reloadMetadata?: () => void;
  onDownloadPackage: (which: OrgType) => void;
  onExportSummary: () => void;
  onDeployToTarget: () => void;
  onClose: () => void;
}

export const ViewOrCompareMetadataModalFooter: FunctionComponent<ViewOrCompareMetadataModalFooterProps> = ({
  hasSourceMetadata,
  hasTargetMetadata,
  hasTargetMetadataContent,
  sourceLoading,
  sourceLastChecked,
  targetLoading,
  targetLastChecked,
  isChromeExtension,
  reloadMetadata,
  onDownloadPackage,
  onExportSummary,
  onDeployToTarget,
  onClose,
}) => {
  const hasBoth = hasSourceMetadata && hasTargetMetadata;
  return (
    <Grid align="spread" verticalAlign="center">
      <div>
        {reloadMetadata && !sourceLoading && !targetLoading && (
          <button className="slds-button slds-button_neutral" onClick={() => reloadMetadata()}>
            Reload Metadata
          </button>
        )}
        {sourceLoading && (
          <div className="slds-truncate" title={`last checked at ${sourceLastChecked?.toLocaleTimeString() || '<waiting>'}`}>
            Loading metadata from Salesforce {sourceLastChecked && <span>- last checked at {sourceLastChecked.toLocaleTimeString()}</span>}
          </div>
        )}
        {targetLoading && (
          <div className="slds-truncate" title={`last checked at ${targetLastChecked?.toLocaleTimeString() || '<waiting>'}`}>
            Loading metadata from Salesforce {targetLastChecked && <span>- last checked at {targetLastChecked.toLocaleTimeString()}</span>}
          </div>
        )}
      </div>
      <Grid>
        <Tooltip
          content={
            hasTargetMetadata
              ? 'Deploy changes to the target org, confirm which metadata components to deploy on the next screen'
              : 'Select a target org to deploy changes'
          }
        >
          <button
            className="slds-button slds-button_brand slds-m-right_x-small"
            onClick={() => onDeployToTarget()}
            disabled={!hasTargetMetadata}
          >
            <Icon type="utility" icon="share" className="slds-button__icon slds-button__icon_left" omitContainer />
            Deploy Changes
          </button>
        </Tooltip>
        <button
          className="slds-button slds-button_neutral"
          onClick={() => onDownloadPackage('SOURCE')}
          disabled={!hasSourceMetadata || sourceLoading}
        >
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          Source Package
        </button>

        {!isChromeExtension && (
          <>
            <button
              className="slds-button slds-button_neutral"
              onClick={() => onDownloadPackage('TARGET')}
              disabled={!hasTargetMetadata || targetLoading || !hasTargetMetadataContent}
            >
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              Target Package
            </button>

            <button className="slds-button slds-button_neutral" onClick={() => onExportSummary()} disabled={!hasBoth}>
              <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
              Export Comparison
            </button>
          </>
        )}

        <button className="slds-button slds-button_neutral" onClick={() => onClose()}>
          Close
        </button>
      </Grid>
    </Grid>
  );
};

export default ViewOrCompareMetadataModalFooter;
