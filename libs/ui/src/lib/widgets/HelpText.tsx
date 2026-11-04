import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from './Icon';
import Tooltip from './Tooltip';

export interface HelpTextProps {
  /**
   * Id for the (visually hidden) help content so form controls can reference it via
   * aria-describedby — focusing the field then announces the help text. Callers conventionally use
   * `${fieldId}-label-help-text`.
   */
  id?: string;
  content: string | React.ReactNode;
  className?: string;
}

/**
 * Field-level help icon. The trigger is a real button so keyboard users can reveal the tooltip
 * (focus opens it; Escape dismisses); the content also renders as hidden text with the given id so
 * the associated input can announce it via aria-describedby.
 */
export const HelpText: FunctionComponent<HelpTextProps> = ({ id, content, className }) => {
  return (
    <div className={classNames('slds-form-element__icon', className)}>
      <Tooltip content={content}>
        <button type="button" className="slds-button slds-button_icon" aria-describedby={id}>
          <Icon type="utility" icon="info" omitContainer className="slds-icon slds-icon-text-default slds-icon_xx-small" />
          <span className="slds-assistive-text">Help</span>
        </button>
      </Tooltip>
      <span id={id} className="slds-assistive-text">
        {content}
      </span>
    </div>
  );
};

export default HelpText;
