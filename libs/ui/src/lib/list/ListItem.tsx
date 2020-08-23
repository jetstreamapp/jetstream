/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo, RefObject } from 'react';

export interface ListItemProps {
  liRef?: RefObject<HTMLLIElement>;
  heading: string | JSX.Element;
  subheading?: string;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  onSelected: () => void;
}

export const ListItem = memo<ListItemProps>(({ liRef, heading, subheading, isActive, subheadingPlaceholder, onSelected }) => {
  return (
    <li
      ref={liRef}
      tabIndex={-1}
      className={classNames('slds-item', { 'is-active': isActive })}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onSelected && onSelected();
      }}
    >
      {isString(heading) ? <div>{heading}</div> : heading}
      {subheading && <div className="slds-text-body_small slds-text-color_weak">{subheading}</div>}
      {!subheading && subheadingPlaceholder && (
        <div
          css={css`
            min-height: 18px;
          `}
        ></div>
      )}
    </li>
  );
});

export default ListItem;
