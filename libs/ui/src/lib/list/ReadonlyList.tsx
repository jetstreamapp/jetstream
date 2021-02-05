/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/react';
import { forwardRef, Fragment, RefObject } from 'react';
import ReadonlyListItem from './ReadonlyListItem';

export interface ReadonlyListProps {
  items: any[];
  subheadingPlaceholder?: boolean;
  // function used to extract
  getContent: (
    item: any
  ) => {
    key: string;
    id?: string;
    heading?: string | JSX.Element;
    subheading?: string;
  };
}

export const ReadonlyList = forwardRef<HTMLUListElement, ReadonlyListProps>(
  ({ items, subheadingPlaceholder = false, getContent }, ref: RefObject<HTMLUListElement>) => {
    return (
      <Fragment>
        {Array.isArray(items) && items.length > 0 && (
          <ul ref={ref} className="slds-has-dividers_bottom-space">
            {items.map((item, i) => {
              const { key, heading, subheading } = getContent(item);
              return <ReadonlyListItem key={key} heading={heading} subheading={subheading} subheadingPlaceholder={subheadingPlaceholder} />;
            })}
          </ul>
        )}
      </Fragment>
    );
  }
);

export default ReadonlyList;
