/* eslint-disable jsx-a11y/anchor-is-valid */
import { UiTabSection, SizeLg, SizeMd } from '@jetstream/types';
import classNames from 'classnames';
import React, { FunctionComponent, useState } from 'react';
import Icon from '../widgets/Icon';

export interface TabsProps {
  tabs: UiTabSection[];
  initialActiveId?: string;
  className?: string; // slds-tabs_medium, slds-tabs_large, slds-tabs_card
  onChange?: (activeId: string) => void;
}

export const Tabs: FunctionComponent<TabsProps> = ({ tabs, initialActiveId, className, onChange }) => {
  const [activeId, setActiveId] = useState(initialActiveId || (tabs && tabs[0] && tabs[0].id));

  function handleTabClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, { id }: UiTabSection) {
    event.preventDefault();
    setActiveId(id);
    if (onChange) {
      onChange(id);
    }
  }

  return (
    <div className={classNames('slds-tabs_default', className)}>
      <ul className="slds-tabs_default__nav" role="tablist">
        {tabs.map((tab) => (
          <li
            key={tab.id}
            className={classNames('slds-tabs_default__item', tab.titleClassName, { 'slds-is-active': activeId === tab.id })}
            title={tab.titleText || (tab.title as string)}
            role="presentation"
          >
            <a
              className="slds-tabs_default__link"
              role="tab"
              tabIndex={0}
              aria-selected={activeId === tab.id}
              aria-controls={tab.id}
              id={`tab-${tab.id}`}
              onClick={(ev) => handleTabClick(ev, tab)}
            >
              {tab.title}
            </a>
          </li>
        ))}
      </ul>
      {tabs.map((tab) => {
        const isVisibleClass = activeId === tab.id ? 'slds-show' : 'slds-hide';
        return (
          <div
            key={tab.id}
            id={tab.id}
            className={classNames('slds-tabs_default__content', isVisibleClass)}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
};

export default Tabs;
