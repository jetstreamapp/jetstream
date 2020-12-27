/** @jsx jsx */
import { jsx } from '@emotion/react';
import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { Fragment, FunctionComponent } from 'react';
import { AutomationControlParentSobject } from '../automation-control-types';
interface AutomationControlTabContentButtonsProps {
  item: AutomationControlParentSobject;
  isDirty: boolean;
  toggleAll: (value: boolean | null) => void;
  onExport: () => void;
}

export const AutomationControlTabContentButtons: FunctionComponent<AutomationControlTabContentButtonsProps> = ({
  item,
  isDirty,
  toggleAll,
  onExport,
}) => {
  const loading = Object.values(item.automationItems).some((automationItem) => !automationItem.hasLoaded);
  return (
    <Fragment>
      <button className={classNames('slds-button slds-button_neutral')} title="Export" onClick={() => onExport()} disabled={loading}>
        <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
        Export
      </button>
      <button
        className={classNames('slds-button slds-button_neutral')}
        title="Reset Changes"
        onClick={() => toggleAll(null)}
        disabled={loading || !isDirty}
      >
        <Icon type="utility" icon="undo" className="slds-button__icon slds-button__icon_left" omitContainer />
        Reset Changes
      </button>
      <button
        className={classNames('slds-button slds-button_neutral')}
        title="Enable All"
        onClick={() => toggleAll(true)}
        disabled={loading}
      >
        <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
        Enable All
      </button>
      <button
        className={classNames('slds-button slds-button_neutral')}
        title="Disable All"
        onClick={() => toggleAll(false)}
        disabled={loading}
      >
        <Icon type="utility" icon="dash" className="slds-button__icon slds-button__icon_left" omitContainer />
        Disable All
      </button>
    </Fragment>
  );
};
export default AutomationControlTabContentButtons;
