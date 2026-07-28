import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';

export interface ExpandCollapseButtonProps {
  /** Whether any tree groups are currently expanded; drives the toggle label and icon. */
  isExpanded: boolean;
  /** Called with the desired next state: `true` to expand all, `false` to collapse all. */
  onToggle: (expand: boolean) => void;
  className?: string;
}

/** Single expand-all / collapse-all toggle shown above a grouped tree grid. */
export const ExpandCollapseButton: FunctionComponent<ExpandCollapseButtonProps> = ({ isExpanded, onToggle, className }) => (
  <div className={classNames('slds-grid slds-m-bottom_xx-small', className)}>
    <button
      type="button"
      className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
      onClick={() => onToggle(!isExpanded)}
    >
      <Icon
        type="utility"
        icon={isExpanded ? 'collapse_all' : 'expand_all'}
        className="slds-button__icon slds-button__icon_left"
        omitContainer
      />
      {isExpanded ? 'Collapse all' : 'Expand all'}
    </button>
  </div>
);

export default ExpandCollapseButton;
