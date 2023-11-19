import { css } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo, MouseEvent, RefObject } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface ListItemCheckboxProps {
  id: string;
  testId?: string;
  inputRef?: RefObject<HTMLInputElement>;
  heading?: Maybe<string | JSX.Element>;
  subheading?: Maybe<string>;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  searchTerm?: string;
  highlightText?: boolean;
  disabled?: boolean;
  onSelected: () => void;
}

export const ListItemCheckbox = memo<ListItemCheckboxProps>(
  ({ id, testId, inputRef, heading, subheading, isActive, subheadingPlaceholder, searchTerm, highlightText, disabled, onSelected }) => {
    const highlightedHeading = useHighlightedText(heading, searchTerm, { className: 'slds-truncate', ignoreHighlight: !highlightText });
    const highlightedSubHeading = useHighlightedText(subheading, searchTerm, {
      ignoreHighlight: !highlightText,
    });
    function handleClick(ev: MouseEvent<HTMLLIElement>) {
      ev.stopPropagation();
      !disabled && onSelected && onSelected();
    }
    return (
      <li
        role="option"
        aria-selected={isActive}
        data-testid={testId}
        className={classNames('slds-item', { 'is-active': isActive })}
        tabIndex={-1}
        onClick={handleClick}
      >
        <div className="slds-grid slds-has-flexi-truncate">
          <div>
            <Checkbox
              inputRef={inputRef}
              id={id}
              checked={!!isActive}
              label=""
              hideLabel
              disabled={disabled}
              onChange={() => !disabled && onSelected && onSelected()}
            />
          </div>
          <div className="slds-col slds-grow slds-has-flexi-truncate">
            {isString(heading) ? <span>{highlightedHeading}</span> : heading}
            {subheading && <span className="slds-text-body_small slds-text-color_weak">{highlightedSubHeading}</span>}
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
