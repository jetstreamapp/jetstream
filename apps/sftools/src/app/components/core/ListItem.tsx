/** @jsx jsx */
import React, { FunctionComponent } from 'react';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { css, jsx } from '@emotion/core';

export interface ListItemProps {
  heading: string | JSX.Element;
  subheading?: string;
  isActive?: boolean;
  onSelected: () => void;
}

export const ListItem: FunctionComponent<ListItemProps> = ({ heading, subheading, isActive, onSelected }) => {
  function handleClick(event: React.MouseEvent<HTMLLIElement, MouseEvent>) {
    event.preventDefault();
    event.stopPropagation();
    onSelected && onSelected();
  }

  return (
    <li
      className={classNames('slds-item', { 'is-active': isActive })}
      css={css`
        cursor: pointer;
        &:hover {
          /* background-color: #f3f2f2; */
          background-color: $brand-accessible;
        }
        &.is-active {
          background-color: #faffbd;
        }
      `}
      onClick={handleClick}
    >
      {isString(heading) ? <div>{heading}</div> : heading}
      {subheading && <div className="slds-text-body_small slds-text-color_weak">{subheading}</div>}
    </li>
  );
};

export default ListItem;
