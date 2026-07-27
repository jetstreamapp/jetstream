import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { Checkbox, Icon } from '@jetstream/ui';
import { dataHistoryCaptureEnabledState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { FunctionComponent } from 'react';
import { Link } from 'react-router';

/**
 * Global-actions icon button linking to the Data History page — rendered in the header next to the
 * background-jobs icon so history is reachable from anywhere in the app.
 */
export const HeaderDataHistoryButton: FunctionComponent = () => {
  return (
    <Link
      to={{ pathname: APP_ROUTES.DATA_HISTORY.ROUTE, search: APP_ROUTES.DATA_HISTORY.SEARCH_PARAM }}
      className="slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__item-action"
      title={APP_ROUTES.DATA_HISTORY.DESCRIPTION}
    >
      <Icon type="utility" icon="clock" className="slds-button__icon slds-global-header__icon" omitContainer />
      <span className="slds-assistive-text">{APP_ROUTES.DATA_HISTORY.TITLE}</span>
    </Link>
  );
};

const SKIP_HISTORY_TEXT = {
  load: { action: 'load', records: 'loaded records' },
  update: { action: 'update', records: 'updated records' },
} as const;

export interface SkipDataHistoryCheckboxProps {
  /** Wording for the label and help text — "this load"/"loaded records" vs "this update"/"updated records" */
  operation: keyof typeof SKIP_HISTORY_TEXT;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  /** Also render the "View Data History" link beneath the checkbox */
  showViewLink?: boolean;
  onChange: (skipHistory: boolean) => void;
}

/**
 * Per-run "don't save this one to Data History" opt-out, shared by every capture surface (load
 * records, load to multiple objects, mass update, bulk update from query). Renders nothing when
 * capture is off, so callers do not repeat that gate — there is nothing to opt out of.
 */
export const SkipDataHistoryCheckbox: FunctionComponent<SkipDataHistoryCheckboxProps> = ({
  operation,
  checked,
  disabled,
  className,
  showViewLink,
  onChange,
}) => {
  // Seeded during app init (see AppInitializer) so this renders synchronously
  const captureEnabled = useAtomValue(dataHistoryCaptureEnabledState);
  if (!captureEnabled) {
    return null;
  }
  const { action, records } = SKIP_HISTORY_TEXT[operation];
  return (
    <div className={className}>
      <Checkbox
        id={`skip-data-history-${operation}`}
        checked={checked}
        label={`Don't save this ${action} to Data History`}
        labelHelp={`Data History keeps a local copy of your ${records} and results on this device. Check this to skip saving this particular ${action}.`}
        disabled={disabled}
        onChange={onChange}
      />
      {showViewLink && <ViewDataHistoryLink className="slds-m-top_xx-small" />}
    </div>
  );
};

/**
 * Inline "View Data History" text link for feature surfaces that capture history (load options,
 * mass-update advanced options, settings).
 */
export const ViewDataHistoryLink: FunctionComponent<{ className?: string }> = ({ className }) => {
  return (
    <Link
      to={{ pathname: APP_ROUTES.DATA_HISTORY.ROUTE, search: APP_ROUTES.DATA_HISTORY.SEARCH_PARAM }}
      className={classNames('slds-grid slds-grid_vertical-align-center', className)}
      title={APP_ROUTES.DATA_HISTORY.DESCRIPTION}
    >
      <Icon
        type="utility"
        icon="clock"
        className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-right_xx-small"
        omitContainer
      />
      View Data History
    </Link>
  );
};
