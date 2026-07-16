import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { FunctionComponent } from 'react';

export interface PermissionAnalysisExpandCollapseControlsProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  className?: string;
}

/** Expand all / Collapse all controls shown above a permission-analysis tree grid. */
export const PermissionAnalysisExpandCollapseControls: FunctionComponent<PermissionAnalysisExpandCollapseControlsProps> = ({
  onExpandAll,
  onCollapseAll,
  className,
}) => (
  <div className={classNames('slds-grid slds-grid_align-end slds-m-bottom_xx-small', className)}>
    <button type="button" className="slds-button slds-button_neutral collapsible-button collapsible-button-xs" onClick={onExpandAll}>
      <Icon type="utility" icon="expand_all" className="slds-button__icon slds-button__icon_left" omitContainer />
      Expand all
    </button>
    <button
      type="button"
      className="slds-button slds-button_neutral collapsible-button collapsible-button-xs slds-m-left_xx-small"
      onClick={onCollapseAll}
    >
      <Icon type="utility" icon="collapse_all" className="slds-button__icon slds-button__icon_left" omitContainer />
      Collapse all
    </button>
  </div>
);

export default PermissionAnalysisExpandCollapseControls;
