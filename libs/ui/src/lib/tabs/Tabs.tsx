/* eslint-disable jsx-a11y/anchor-is-valid */
import { UiTabSection, HorizontalVertical } from '@jetstream/types';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import React, { FunctionComponent, useEffect, useState } from 'react';
import Icon from '../widgets/Icon';

export interface TabsProps {
  position?: HorizontalVertical;
  tabs: UiTabSection[];
  initialActiveId?: string;
  className?: string; // slds-tabs_medium, slds-tabs_large, slds-tabs_card
  style?: React.CSSProperties;
  ulStyle?: React.CSSProperties;
  onChange?: (activeId: string) => void;
}

export const Tabs: FunctionComponent<TabsProps> = ({
  position = 'horizontal',
  tabs,
  initialActiveId,
  className,
  style,
  ulStyle,
  onChange,
}) => {
  const isHorizontal = position === 'horizontal';
  const [activeId, setActiveId] = useState(() => {
    return initialActiveId || (tabs && tabs[0] && tabs[0].id);
  });

  const [activeTab, setActiveTab] = useState<UiTabSection>(() => {
    if (initialActiveId) {
      return tabs.find((tab) => tab.id === initialActiveId);
    } else if (tabs) {
      return tabs[0];
    }
  });

  useEffect(() => {
    if (tabs && activeId) {
      setActiveTab(tabs.find((tab) => tab.id === activeId));
    }
  }, [tabs, activeId]);

  useEffect(() => {
    if (initialActiveId && initialActiveId !== activeId) {
      setActiveId(initialActiveId);
    }
  }, [initialActiveId]);

  function handleTabClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, tab: UiTabSection) {
    event.preventDefault();
    // setActiveTab(tabs.find((currTab) => currTab.id === tab.id));
    setActiveId(tab.id);
    if (onChange) {
      onChange(tab.id);
    }
  }

  return (
    <div className={classNames({ 'slds-tabs_default': isHorizontal, 'slds-vertical-tabs': !isHorizontal }, className)} style={style}>
      <ul
        className={classNames({ 'slds-tabs_default__nav': isHorizontal, 'slds-vertical-tabs__nav': !isHorizontal })}
        role="tablist"
        aria-orientation={position}
        style={ulStyle}
      >
        {tabs.map((tab) => (
          <li
            key={tab.id}
            className={classNames(
              { 'slds-tabs_default__item': isHorizontal, 'slds-vertical-tabs__nav-item': !isHorizontal },
              tab.titleClassName,
              { 'slds-is-active': activeId === tab.id }
            )}
            title={tab.titleText || (tab.title as string)}
            role="presentation"
          >
            <a
              className={classNames({ 'slds-tabs_default__link': isHorizontal, 'slds-vertical-tabs__link': !isHorizontal })}
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
      {activeTab && (
        <div
          key={activeTab.id}
          id={activeTab.id}
          className={classNames({ 'slds-tabs_default__content': isHorizontal, 'slds-vertical-tabs__content': !isHorizontal }, 'slds-show')}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      )}
      {isNil(activeTab) && tabs && tabs.length > 0 && (
        <h3 className="slds-text-heading_medium slds-m-around_medium">Select an item to continue</h3>
      )}
    </div>
  );
};

export default Tabs;
