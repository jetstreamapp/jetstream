/* eslint-disable @typescript-eslint/no-explicit-any */

import { Maybe } from '@jetstream/types';
import { forwardRef, Fragment, RefObject } from 'react';
import ReadonlyListItem from './ReadonlyListItem';

export interface ReadonlyListProps {
  items: any[];
  subheadingPlaceholder?: boolean;
  // function used to extract
  getContent: (item: any) => {
    key: string;
    id?: string;
    heading?: Maybe<string | JSX.Element>;
    subheading?: Maybe<string>;
  };
}

export const ReadonlyList = forwardRef<HTMLUListElement, ReadonlyListProps>(
  ({ items, subheadingPlaceholder = false, getContent }, ref: RefObject<HTMLUListElement>) => {
    return (
      // eslint-disable-next-line react/jsx-no-useless-fragment
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
