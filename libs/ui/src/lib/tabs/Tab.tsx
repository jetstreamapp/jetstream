/* eslint-disable jsx-a11y/anchor-is-valid */

import { UiTabSection } from '@jetstream/types';
import classNames from 'classnames';
import React from 'react';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface TabProps {
  tab: UiTabSection;
  isHorizontal: boolean;
  activeId: string;
  searchTerm?: string;
  highlightText?: boolean;
  handleTabClick: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>, tab: UiTabSection) => void;
}

export const Tab = ({ tab, isHorizontal, activeId, searchTerm, highlightText, handleTabClick }: TabProps) => {
  const highlightedHeading = useHighlightedText(tab.title, searchTerm, { ignoreHighlight: !highlightText });
  return (
    <li
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
        {highlightedHeading}
      </a>
    </li>
  );
};

export default Tab;
