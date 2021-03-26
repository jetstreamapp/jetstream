/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import classNames from 'classnames';
import isString from 'lodash/isString';
import { memo, RefObject } from 'react';
import { useHighlightedText } from '../hooks/useHighlightedText';

export interface ListItemProps {
  liRef?: RefObject<HTMLLIElement>;
  heading: string | JSX.Element;
  subheading?: string;
  isActive?: boolean;
  subheadingPlaceholder?: boolean;
  searchTerm?: string;
  highlightText?: boolean;
  onSelected: () => void;
}

export const ListItem = memo<ListItemProps>(
  ({ liRef, heading, subheading, isActive, subheadingPlaceholder, searchTerm, highlightText, onSelected }) => {
    const highlightedHeading = useHighlightedText(heading, searchTerm, { ignoreHighlight: !highlightText });
    const highlightedSubHeading = useHighlightedText(subheading, searchTerm, {
      ignoreHighlight: !highlightText,
    });
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
        {isString(heading) ? <div className="slds-truncate">{highlightedHeading}</div> : heading}
        {subheading && <div className="slds-text-body_small slds-text-color_weak slds-truncate">{highlightedSubHeading}</div>}
        {!subheading && subheadingPlaceholder && (
          <div
            css={css`
              min-height: 18px;
            `}
          ></div>
        )}
      </li>
    );
  }
);

export default ListItem;
