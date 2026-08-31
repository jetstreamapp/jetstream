/* eslint-disable jsx-a11y/anchor-is-valid */

import { css } from '@emotion/react';
import { UiTabSection } from '@jetstream/types';
import classNames from 'classnames';
import React from 'react';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface TabProps {
  tab: UiTabSection;
  isHorizontal: boolean;
  /** Set false when the tab bar scrolls horizontally (labels stay full width and the bar scrolls) */
  truncateLabels?: boolean;
  activeId: string;
  /** The tab carrying tabIndex=0 — the active tab, unless the filter hid it (then the first visible tab) */
  rovingTabId?: string;
  searchTerm?: string;
  highlightText?: boolean;
  handleTabClick: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, tab: UiTabSection) => void;
}

export const Tab = ({
  tab,
  isHorizontal,
  truncateLabels = true,
  activeId,
  rovingTabId = activeId,
  searchTerm,
  highlightText,
  handleTabClick,
}: TabProps) => {
  const highlightedHeading = useHighlightedText(tab.title, searchTerm, { ignoreHighlight: !highlightText });
  return (
    <li
      className={classNames(
        { 'slds-tabs_default__item': isHorizontal, 'slds-vertical-tabs__nav-item': !isHorizontal },
        tab.titleClassName,
        { 'slds-is-active': activeId === tab.id },
      )}
      // Flex items refuse to shrink below their nowrap text width by default, so narrow containers
      // had tab labels overflowing the panel — allow shrinking and truncate instead. Scrolling tab
      // bars opt out via truncateLabels={false}: there the full label stays and the bar scrolls.
      css={
        truncateLabels
          ? css`
              min-width: 0;
              a {
                overflow: hidden;
                text-overflow: ellipsis;
              }
            `
          : undefined
      }
      title={tab.titleText || (tab.title as string)}
      role="presentation"
    >
      <a
        className={classNames({ 'slds-tabs_default__link': isHorizontal, 'slds-vertical-tabs__link': !isHorizontal })}
        role="tab"
        // Roving tabindex: only one tab is in the page tab order; arrow keys move between tabs
        tabIndex={rovingTabId === tab.id ? 0 : -1}
        aria-selected={activeId === tab.id}
        aria-controls={tab.id}
        id={`tab-${tab.id}`}
        onClick={(ev) => handleTabClick(ev, tab)}
      >
        {highlightedHeading}
      </a>
    </li>
  );
};

export default Tab;
