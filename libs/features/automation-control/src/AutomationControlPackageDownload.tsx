import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { AssistiveStatus, DropDown, FileDownloadModal, Icon } from '@jetstream/ui';
import { fromJetstreamEvents, useAnalytics } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { Fragment, FunctionComponent, MutableRefObject, useEffect, useRef } from 'react';
import { AutomationPackageVariant } from './automation-control-package-utils';
import { AutomationPackageDownload } from './useAutomationPackageDownload';

const MAX_MISSING_LABELS_SHOWN = 5;

export interface AutomationPackageDropDownProps {
  className?: string;
  disabled?: boolean;
  isPreparing: boolean;
  /** The menu's trigger button, see `packageTriggerRef` from useAutomationPackageDownload */
  triggerRef: MutableRefObject<HTMLButtonElement | null>;
  onSelected: (variant: AutomationPackageVariant) => void;
}

export const AutomationPackageDropDown: FunctionComponent<AutomationPackageDropDownProps> = ({
  className,
  disabled,
  isPreparing,
  triggerRef,
  onSelected,
}) => {
  const isDisabled = !!disabled || isPreparing;
  // The trigger is disabled while the package is prepared, which drops its focus. When preparing fails the menu
  // stays, so focus goes back to it once enabled (a successful package opens the download modal instead).
  const focusTriggerWhenEnabledRef = useRef(false);

  useEffect(() => {
    if (!isDisabled && focusTriggerWhenEnabledRef.current) {
      focusTriggerWhenEnabledRef.current = false;
      if (!document.activeElement || document.activeElement === document.body) {
        triggerRef.current?.focus();
      }
    }
  }, [isDisabled, triggerRef]);

  return (
    <Fragment>
      <AssistiveStatus message={isPreparing ? 'Preparing package' : ''} />
      <DropDown
        className={className}
        buttonClassName="slds-button slds-button_neutral"
        disabled={isDisabled}
        triggerRef={triggerRef}
        usePortal
        buttonContent={
          <span>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
            {isPreparing ? 'Preparing Package...' : 'Download Package'}
            <Icon
              type="utility"
              icon="down"
              className="slds-button__icon slds-button__icon_right slds-button__icon_x-small"
              omitContainer
            />
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
        onSelected={(variant) => {
          focusTriggerWhenEnabledRef.current = true;
          onSelected(variant as AutomationPackageVariant);
        }}
      />
    </Fragment>
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
