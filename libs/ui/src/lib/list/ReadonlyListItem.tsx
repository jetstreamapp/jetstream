/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import isString from 'lodash/isString';
import { memo } from 'react';

export interface ReadonlyListItemProps {
  heading: string | JSX.Element;
  subheading?: string;
  subheadingPlaceholder?: boolean;
}

export const ReadonlyListItem = memo<ReadonlyListItemProps>(({ heading, subheading, subheadingPlaceholder }) => {
  return (
    <li className="slds-item read-only">
      {isString(heading) ? <div className="slds-truncate">{heading}</div> : heading}
      {subheading && <div className="slds-text-body_small slds-text-color_weak slds-truncate">{subheading}</div>}
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

export default ReadonlyListItem;
