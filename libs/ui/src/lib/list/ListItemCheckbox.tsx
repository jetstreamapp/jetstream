import { css } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo, MouseEvent, ReactNode, RefObject } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface ListItemCheckboxProps {
  id: string;
  testId?: string;
  inputRef?: RefObject<HTMLInputElement>;
  label?: Maybe<string>;
  heading?: Maybe<string | ReactNode>;
  subheading?: Maybe<string>;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  searchTerm?: string;
  highlightText?: boolean;
  disabled?: boolean;
  onSelected: () => void;
  children?: ReactNode;
}

export const ListItemCheckbox = memo<ListItemCheckboxProps>(
  ({
    id,
    testId,
    inputRef,
    label,
    heading,
    subheading,
    isActive,
    subheadingPlaceholder,
    searchTerm,
    highlightText,
    disabled,
    onSelected,
    children,
  }) => {
    const highlightedHeading = useHighlightedText(heading, searchTerm, { className: 'slds-truncate', ignoreHighlight: !highlightText });
    const highlightedSubHeading = useHighlightedText(subheading, searchTerm, {
      ignoreHighlight: !highlightText,
    });
    function handleClick(ev: MouseEvent<HTMLLIElement>) {
      ev.stopPropagation();
      // Activating the checkbox itself (Space, or clicking the box/label) fires its own change
      // event AND a bubbled click — toggling again here would cancel the user's action out
      if ((ev.target as HTMLElement).closest('input, label')) {
        return;
      }
      !disabled && onSelected && onSelected();
    }
    return (
      // Pointer-only enlargement of the checkbox's target: clicking anywhere on the row toggles it. The
      // keyboard path is the checkbox itself (Space) plus the list's arrow-key navigation.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
      <li
        // Not role="option": options cannot contain interactive children, and focus deliberately
        // moves to the labeled checkbox, which announces its own name and checked state
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
              // The visible heading is not associated with the input, so give the checkbox an
              // assistive-text label (heading when it is plain text, else subheading/id)
              label={label || (isString(heading) ? heading : subheading) || id}
              hideLabel
              // Roving tabindex: the list is a single tab stop (the ul) and arrow keys move focus
              // between checkboxes — without this, every field checkbox floods the page tab order
              tabIndex={-1}
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
        {children}
      </li>
    );
  },
);

export default ListItemCheckbox;
