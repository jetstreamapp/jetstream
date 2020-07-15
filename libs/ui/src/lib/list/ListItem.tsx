/** @jsx jsx */
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo } from 'react';

export interface ListItemProps {
  heading: string | JSX.Element;
  subheading?: string;
  isActive?: boolean;
  onSelected: () => void;
}

export const ListItem = memo<ListItemProps>(({ heading, subheading, isActive, onSelected }) => {
  return (
    <li
      className={classNames('slds-item', { 'is-active': isActive })}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelected && onSelected();
      }}
    >
      {isString(heading) ? <div>{heading}</div> : heading}
      {subheading && <div className="slds-text-body_small slds-text-color_weak">{subheading}</div>}
    </li>
  );
});

export default ListItem;
