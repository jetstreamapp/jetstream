/* eslint-disable jsx-a11y/anchor-is-valid */
/** @jsx jsx */
import { jsx } from '@emotion/core';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { HorizontalVertical, UiTabSection } from '@jetstream/types';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import React, { FunctionComponent, useEffect, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';

export interface TabsProps {
  position?: HorizontalVertical;
  filterVisible?: boolean; // only applies to vertical tabs
  filterPlaceholder?: string; // only applies to vertical tabs
  tabs: UiTabSection[];
  initialActiveId?: string;
  className?: string; // slds-tabs_medium, slds-tabs_large, slds-tabs_card
  contentClassname?: string;
  style?: React.CSSProperties;
  ulStyle?: React.CSSProperties;
  emptyState?: React.ReactNode;
  onChange?: (activeId: string) => void;
}

export const Tabs: FunctionComponent<TabsProps> = ({
  position = 'horizontal',
  filterVisible,
  filterPlaceholder = 'Search',
  tabs,
  initialActiveId,
  className,
  contentClassname,
  style,
  ulStyle,
  emptyState = <h3 className="slds-text-heading_medium slds-m-around_medium">Select an item to continue</h3>,
  onChange,
  children,
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
  const [filterValue, setFilterValue] = useState('');
  const [filteredTabs, setFilteredTabs] = useState(tabs);

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

  useEffect(() => {
    if (!filterValue && tabs !== filteredTabs) {
      setFilteredTabs(tabs);
    } else if (filterValue) {
      const value = new RegExp(filterValue.replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, ''), 'i');
      setFilteredTabs(tabs.filter((tab) => value.test(`${tab.titleText || tab.title}${tab.id}`)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs, filterValue]);

  function handleTabClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, tab: UiTabSection) {
    event.preventDefault();
    // setActiveTab(tabs.find((currTab) => currTab.id === tab.id));
    setActiveId(tab.id);
    if (onChange) {
      onChange(tab.id);
    }
  }

  function getContent() {
    if (activeTab) {
      return (
        <div
          id={activeTab.id}
          className={classNames(
            { 'slds-tabs_default__content': isHorizontal, 'slds-vertical-tabs__content': !isHorizontal },
            'slds-show',
            contentClassname
          )}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab.id}`}
        >
          {activeTab.content}
        </div>
      );
    } else if (isNil(activeTab) && tabs && tabs.length > 0) {
      return emptyState;
    } else {
      return (
        <div
          className={classNames(
            { 'slds-tabs_default__content': isHorizontal, 'slds-vertical-tabs__content': !isHorizontal },
            'slds-show',
            contentClassname
          )}
          role="tabpanel"
        />
      );
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
        {children}
        {filterVisible && position === 'vertical' && (
          <div className="slds-p-bottom--xx-small">
            <SearchInput
              id="accordion-input-filter"
              placeholder={filterPlaceholder}
              autoFocus
              onChange={setFilterValue}
              // onArrowKeyUpDown={handleSearchKeyboard}
            />
            <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
              Showing {formatNumber(filteredTabs.length)} of {formatNumber(tabs.length)} items
            </div>
          </div>
        )}
        {filteredTabs.map((tab) => (
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
      {getContent()}
    </div>
  );
};

export default Tabs;
