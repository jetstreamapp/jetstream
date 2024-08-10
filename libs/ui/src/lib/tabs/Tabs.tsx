/* eslint-disable jsx-a11y/anchor-is-valid */

import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { HorizontalVertical, UiTabSection } from '@jetstream/types';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import React, { ReactNode, forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import SearchInput from '../form/search-input/SearchInput';
import Tab from './Tab';

export interface TabsRef {
  changeTab: (id: string) => void;
}

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
  onFilterValueChange?: (value: string) => void;
  onChange?: (activeId: string) => void;
  children?: ReactNode;
}

export const Tabs = forwardRef<unknown, TabsProps>(
  (
    {
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
      onFilterValueChange,
      onChange,
      children,
    },
    ref
  ) => {
    const isHorizontal = position === 'horizontal';
    const [activeId, setActiveId] = useState(() => {
      return initialActiveId || (tabs && tabs[0] && tabs[0].id);
    });

    const [activeTab, setActiveTab] = useState<UiTabSection | undefined>(() => {
      if (initialActiveId) {
        return tabs.find((tab) => tab.id === initialActiveId);
      } else if (tabs) {
        return tabs[0];
      }
    });
    const [filterValue, setFilterValue] = useState('');
    const [filteredTabs, setFilteredTabs] = useState(tabs);

    useImperativeHandle<unknown, TabsRef>(ref, () => ({
      changeTab: (id: string) => {
        setActiveId(id);
        onChange?.(id);
      },
    }));

    useEffect(() => {
      if (tabs && activeId) {
        setActiveTab(tabs.find((tab) => tab.id === activeId));
      }
    }, [tabs, activeId]);

    useEffect(() => {
      if (initialActiveId && initialActiveId !== activeId) {
        setActiveId(initialActiveId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialActiveId]);

    useEffect(() => {
      if (!filterValue && tabs !== filteredTabs) {
        setFilteredTabs(tabs);
      } else if (filterValue) {
        setFilteredTabs(tabs.filter(multiWordObjectFilter(['titleText', 'title', 'id'], filterValue)));
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

    function handleFilterChange(value: string) {
      setFilterValue(value);
      if (onFilterValueChange) {
        onFilterValueChange(value);
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
                onChange={handleFilterChange}
                // onArrowKeyUpDown={handleSearchKeyboard}
              />
              <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                Showing {formatNumber(filteredTabs.length)} of {formatNumber(tabs.length)} items
              </div>
            </div>
          )}
          {filteredTabs.map((tab) => (
            <Tab
              key={tab.id}
              tab={tab}
              isHorizontal={isHorizontal}
              activeId={activeId}
              searchTerm={filterValue}
              highlightText
              handleTabClick={handleTabClick}
            />
          ))}
        </ul>
        {getContent()}
      </div>
    );
  }
);

export default Tabs;
