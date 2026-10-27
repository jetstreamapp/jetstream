import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { DropDown, FileDownloadModal, Icon } from '@jetstream/ui';
import { fromJetstreamEvents, useAnalytics } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { AutomationPackageVariant } from './automation-control-package-utils';
import { AutomationPackageDownload } from './useAutomationPackageDownload';

const MAX_MISSING_LABELS_SHOWN = 5;

export interface AutomationPackageDropDownProps {
  className?: string;
  disabled?: boolean;
  isPreparing: boolean;
  onSelected: (variant: AutomationPackageVariant) => void;
}

export const AutomationPackageDropDown: FunctionComponent<AutomationPackageDropDownProps> = ({
  className,
  disabled,
  isPreparing,
  onSelected,
}) => {
  return (
    <DropDown
      className={className}
      buttonClassName="slds-button slds-button_neutral"
      disabled={disabled || isPreparing}
      usePortal
      buttonContent={
        <span>
          <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
          {isPreparing ? 'Preparing Package...' : 'Download Package'}
          <Icon type="utility" icon="down" className="slds-button__icon slds-button__icon_right slds-button__icon_x-small" omitContainer />
        </span>
      }
      actionText="Download a metadata package"
      items={[
        {
          id: 'before',
          value: 'Before these changes',
          title: 'A package that sets each item back to how it was before these changes',
        },
        {
          id: 'after',
          value: 'After these changes',
          title: 'A package that applies these changes',
        },
      ]}
      onSelected={(variant) => onSelected(variant as AutomationPackageVariant)}
    />
  );
};

export interface AutomationPackageDownloadModalProps {
  selectedOrg: SalesforceOrgUi;
  packageDownload: AutomationPackageDownload;
  source: string;
  onClose: () => void;
}

export const AutomationPackageDownloadModal: FunctionComponent<AutomationPackageDownloadModalProps> = ({
  selectedOrg,
  packageDownload,
  source,
  onClose,
}) => {
  const { trackEvent } = useAnalytics();
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const { data, variant, missingItems } = packageDownload;

  let tagline = `Deploy this package from Deploy Metadata to set each item to how it was ${variant} these changes.`;
  if (missingItems.length > 0) {
    const labels = missingItems.slice(0, MAX_MISSING_LABELS_SHOWN).map(({ label }) => label);
    if (missingItems.length > MAX_MISSING_LABELS_SHOWN) {
      labels.push(`and ${formatNumber(missingItems.length - MAX_MISSING_LABELS_SHOWN)} more`);
    }
    tagline += ` ${formatNumber(missingItems.length)} ${pluralizeFromNumber('item', missingItems.length)} could not be found in Salesforce and ${
      missingItems.length === 1 ? 'is' : 'are'
    } not included: ${labels.join(', ')}.`;
  }

  return (
    <FileDownloadModal
      org={selectedOrg}
      googleIntegrationEnabled={hasGoogleDriveAccess}
      googleShowUpgradeToPro={googleShowUpgradeToPro}
      google_apiKey={google_apiKey}
      google_appId={google_appId}
      google_clientId={google_clientId}
      modalHeader={variant === 'before' ? 'Download Package (Before Changes)' : 'Download Package (After Changes)'}
      modalTagline={tagline}
      data={data}
      fileNameParts={['automation', variant, 'changes']}
      allowedTypes={['zip']}
      onModalClose={onClose}
      emitUploadToGoogleEvent={fromJetstreamEvents.emit}
      source={source}
      trackEvent={trackEvent}
    />
  );
};
