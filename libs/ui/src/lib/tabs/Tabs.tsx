import { formatNumber } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { HorizontalVertical, UiTabSection } from '@jetstream/types';
import classNames from 'classnames';
import React, { ReactNode, forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
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
  /**
   * When true, every tab's content is rendered simultaneously and the inactive tabs are hidden
   * with `slds-hide` instead of being unmounted. Use this when child components hold state that
   * must survive tab switches (e.g. in-progress network requests, accumulated results).
   */
  renderAllContent?: boolean;
  onFilterValueChange?: (value: string) => void;
  onChange?: (activeId: string) => void;
  children?: ReactNode;
}

export const Tabs = forwardRef<TabsRef, TabsProps>(
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
      renderAllContent = false,
      onFilterValueChange,
      onChange,
      children,
    },
    ref,
  ) => {
    const isHorizontal = position === 'horizontal';
    const [activeId, setActiveId] = useState(() => {
      return initialActiveId || (tabs && tabs[0] && tabs[0].id);
    });

    const [filterValue, setFilterValue] = useState('');

    // Derived during render rather than mirrored into state with effects. The effect-synced version
    // dispatched a setState after every parent re-render (the `tabs` prop is usually an inline array),
    // which counts toward React's nested-update limit and escalated to "Maximum update depth exceeded"
    // during long update cascades.
    const activeTab = useMemo(() => (tabs && activeId ? tabs.find((tab) => tab.id === activeId) : undefined), [tabs, activeId]);
    const filteredTabs = useMemo(
      () => (filterValue ? tabs.filter(multiWordObjectFilter(['titleText', 'title', 'id'], filterValue)) : tabs),
      [tabs, filterValue],
    );

    useImperativeHandle<TabsRef, TabsRef>(ref, () => ({
      changeTab: (id: string) => {
        setActiveId(id);
        onChange?.(id);
      },
    }));

    useEffect(() => {
      if (initialActiveId && initialActiveId !== activeId) {
        setActiveId(initialActiveId);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialActiveId]);

    function handleTabClick(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, tab: UiTabSection) {
      event.preventDefault();
      setActiveId(tab.id);
      if (onChange) {
        onChange(tab.id);
      }
    }

    function getContent() {
      if (renderAllContent && tabs && tabs.length > 0) {
        return tabs.map((tab) => (
          <div
            key={tab.id}
            id={tab.id}
            className={classNames(
              { 'slds-tabs_default__content': isHorizontal, 'slds-vertical-tabs__content': !isHorizontal },
              tab.id === activeId ? 'slds-show' : 'slds-hide',
              contentClassname,
            )}
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
          >
            {tab.content}
          </div>
        ));
      }
      if (activeTab) {
        return (
          <div
            id={activeTab.id}
            className={classNames(
              { 'slds-tabs_default__content': isHorizontal, 'slds-vertical-tabs__content': !isHorizontal },
              'slds-show',
              contentClassname,
            )}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab.id}`}
          >
            {activeTab.content}
          </div>
        );
      } else if (tabs && tabs.length > 0) {
        return emptyState;
      } else {
        return (
          <div
            className={classNames(
              { 'slds-tabs_default__content': isHorizontal, 'slds-vertical-tabs__content': !isHorizontal },
              'slds-show',
              contentClassname,
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
  },
);

export default Tabs;
