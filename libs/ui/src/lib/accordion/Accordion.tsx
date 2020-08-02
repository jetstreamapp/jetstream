/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/Accordion/#Fixed-Text
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import { FunctionComponent, useState } from 'react';
import Icon from '../widgets/Icon';
import { UiSection } from '@jetstream/types';

export interface AccordionProps {
  initOpenIds: string[];
  sections: UiSection[];
  allowMultiple?: boolean;
}

export const Accordion: FunctionComponent<AccordionProps> = ({ sections, initOpenIds, allowMultiple = true }) => {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(initOpenIds));

  function handleClick(id: string) {
    if (allowMultiple) {
      if (openIds.has(id)) {
        openIds.delete(id);
      } else {
        openIds.add(id);
      }
    } else {
      if (openIds.has(id)) {
        openIds.clear();
      } else {
        openIds.clear();
        openIds.add(id);
      }
    }
    setOpenIds(new Set(openIds));
  }

  return (
    <ul className="slds-accordion">
      {sections.map((item) => (
        <li className="slds-accordion__list-item" key={item.id}>
          <section className={classNames('slds-accordion__section', { 'slds-is-open': openIds.has(item.id) })}>
            <div className="slds-accordion__summary">
              <h3 className="slds-accordion__summary-heading">
                <button
                  aria-controls={item.id}
                  aria-expanded={openIds.has(item.id)}
                  className="slds-button slds-button_reset slds-accordion__summary-action"
                  onClick={() => handleClick(item.id)}
                  disabled={item.disabled}
                >
                  <Icon
                    type="utility"
                    icon="switch"
                    className="slds-accordion__summary-action-icon slds-button__icon slds-button__icon_left"
                    omitContainer
                  />
                  <span className="slds-accordion__summary-content" title={item.title}>
                    {item.title}
                  </span>
                </button>
              </h3>
            </div>
            <div className="slds-accordion__content" id={item.id}>
              {item.content}
            </div>
          </section>
        </li>
      ))}
    </ul>
  );
};

export default Accordion;
