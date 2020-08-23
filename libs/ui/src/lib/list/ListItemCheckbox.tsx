/** @jsx jsx */
import { jsx, css } from '@emotion/core';
import isString from 'lodash/isString';
import { memo, RefObject } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import classNames from 'classnames';

export interface ListItemCheckboxProps {
  id: string;
  inputRef?: RefObject<HTMLInputElement>;
  heading: string | JSX.Element;
  subheading?: string;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  onSelected: () => void;
}

export const ListItemCheckbox = memo<ListItemCheckboxProps>(
  ({ id, inputRef, heading, subheading, isActive, subheadingPlaceholder, onSelected }) => {
    return (
      <li className={classNames('slds-item', { 'is-active': isActive })} tabIndex={-1}>
        <div className="slds-grid slds-has-flexi-truncate">
          <div>
            <Checkbox inputRef={inputRef} id={id} checked={!!isActive} label="" hideLabel onChange={() => onSelected && onSelected()} />
          </div>
          <div className="slds-col slds-grow slds-has-flexi-truncate">
            {isString(heading) ? <div>{heading}</div> : heading}
            {subheading && <div className="slds-text-body_small slds-text-color_weak">{subheading}</div>}
            {!subheading && subheadingPlaceholder && (
              <div
                css={css`
                  min-height: 18px;
                `}
              ></div>
            )}
          </div>
        </div>
      </li>
    );
  }
);

export default ListItemCheckbox;
