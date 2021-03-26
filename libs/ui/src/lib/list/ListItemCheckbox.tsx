/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo, RefObject } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface ListItemCheckboxProps {
  id: string;
  inputRef?: RefObject<HTMLInputElement>;
  heading: string | JSX.Element;
  subheading?: string;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  searchTerm?: string;
  highlightText?: boolean;
  onSelected: () => void;
}

export const ListItemCheckbox = memo<ListItemCheckboxProps>(
  ({ id, inputRef, heading, subheading, isActive, subheadingPlaceholder, searchTerm, highlightText, onSelected }) => {
    const highlightedHeading = useHighlightedText(heading, searchTerm, { className: 'slds-truncate', ignoreHighlight: !highlightText });
    const highlightedSubHeading = useHighlightedText(subheading, searchTerm, {
      ignoreHighlight: !highlightText,
    });
    return (
      <li className={classNames('slds-item', { 'is-active': isActive })} tabIndex={-1}>
        <div className="slds-grid slds-has-flexi-truncate">
          <div>
            <Checkbox inputRef={inputRef} id={id} checked={!!isActive} label="" hideLabel onChange={() => onSelected && onSelected()} />
          </div>
          <div className="slds-col slds-grow slds-has-flexi-truncate">
            {isString(heading) ? <span onClick={() => onSelected && onSelected()}>{highlightedHeading}</span> : heading}
            {subheading && (
              <span className="slds-text-body_small slds-text-color_weak" onClick={() => onSelected && onSelected()}>
                {highlightedSubHeading}
              </span>
            )}
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
