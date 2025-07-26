import classNames from 'classnames';
import isString from 'lodash/isString';
import { FunctionComponent, useState } from 'react';
import Icon from '../widgets/Icon';

export interface SectionProps {
  className?: string;
  contentClassName?: string;
  id: string;
  initialExpanded?: boolean;
  label: string | React.ReactNode;
  title?: string;
  removeFromDomOnCollapse?: boolean;
  noBorder?: boolean;
  children?: React.ReactNode;
}

export const Section: FunctionComponent<SectionProps> = ({
  className,
  contentClassName,
  id,
  initialExpanded = true,
  label,
  title,
  removeFromDomOnCollapse = false,
  noBorder = false,
  children,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  title = isString(title) ? title : isString(label) ? label : '';
  return (
    <div className={classNames('slds-section', { 'slds-is-open': expanded, 'slds-box slds-box_xx-small': !noBorder }, className)}>
      <h3 className="slds-section__title">
        <button
          aria-controls={id}
          aria-expanded={!expanded}
          className="slds-button slds-section__title-action"
          onClick={() => setExpanded(!expanded)}
        >
          <Icon
            type="utility"
            icon="switch"
            omitContainer
            className="slds-section__title-action-icon slds-button__icon slds-button__icon_left"
          />
          <span className="slds-truncate" title={title}>
            {label}
          </span>
        </button>
      </h3>
      <div aria-hidden={!expanded} className={classNames('slds-section__content', contentClassName)} id={id}>
        {removeFromDomOnCollapse && !expanded ? null : children}
      </div>
    </div>
  );
};

export default Section;
