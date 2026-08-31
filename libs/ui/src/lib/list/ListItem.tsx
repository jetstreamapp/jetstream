import { css } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo, ReactNode, RefObject } from 'react';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface ListItemProps {
  liRef?: RefObject<HTMLLIElement>;
  testId?: Maybe<string>;
  heading?: Maybe<string | ReactNode>;
  subheading?: Maybe<string>;
  /**
   * Optional node rendered on the right side of the heading row.
   * Clicks inside this node should stop propagation if row selection is to be avoided.
   */
  trailingHeader?: ReactNode;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  searchTerm?: string;
  highlightText?: boolean;
  disabled?: boolean;
  onSelected: () => void;
  children?: ReactNode;
}

export const ListItem = memo<ListItemProps>(
  ({
    liRef,
    testId,
    heading = '',
    subheading,
    trailingHeader,
    isActive,
    subheadingPlaceholder,
    searchTerm,
    highlightText,
    disabled,
    onSelected,
    children,
  }) => {
    const highlightedHeading = useHighlightedText(heading, searchTerm, { ignoreHighlight: !highlightText });
    const highlightedSubHeading = useHighlightedText(subheading, searchTerm, {
      ignoreHighlight: !highlightText,
    });
    const headingContent = isString(heading) ? (
      <div className="slds-truncate" title={heading}>
        {highlightedHeading}
      </div>
    ) : (
      heading
    );
    return (
      <li
        ref={liRef}
        tabIndex={-1}
        role="option"
        aria-selected={isActive}
        data-testid={testId}
        className={classNames('slds-item', { 'is-active': isActive, disabled })}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          !disabled && onSelected && onSelected();
        }}
      >
        {trailingHeader ? (
          <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
            <div className="slds-truncate slds-grow">{headingContent}</div>
            <div className="slds-no-flex slds-m-left_xx-small">{trailingHeader}</div>
          </div>
        ) : (
          headingContent
        )}
        {subheading && (
          <div className="slds-text-body_small slds-text-color_weak slds-truncate" title={subheading}>
            {highlightedSubHeading}
          </div>
        )}
        {!subheading && subheadingPlaceholder && (
          <div
            css={css`
              min-height: 18px;
            `}
          ></div>
        )}
        {children}
      </li>
    );
  },
);

export default ListItem;
