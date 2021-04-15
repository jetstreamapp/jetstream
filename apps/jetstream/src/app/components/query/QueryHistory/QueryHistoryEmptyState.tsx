/** @jsx jsx */
import { jsx } from '@emotion/react';
import { EmptyState } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';

export interface QueryHistoryEmptyStateProps {
  whichType: 'HISTORY' | 'SAVED';
  whichOrg: 'ALL' | 'SELECTED';
}

export const QueryHistoryEmptyState: FunctionComponent<QueryHistoryEmptyStateProps> = ({ whichType, whichOrg }) => {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');

  useEffect(() => {
    if (whichType === 'HISTORY') {
      if (whichOrg === 'SELECTED') {
        setText1(`You don't have any query history for the selected org.`);
      } else {
        setText1(`You don't have any saved query history.`);
      }
      setText2(`Come back once you have performed some queries.`);
    } else {
      if (whichOrg === 'SELECTED') {
        setText1(`You don't have any saved queries for the currently selected org.`);
      } else {
        setText1(`You don't have any saved queries.`);
      }
      setText2(`Click the plus icon on a query from your history to save it.`);
    }
  }, [whichType, whichOrg]);

  return (
    <Fragment>
      <EmptyState headline={text1} subHeading={text2}></EmptyState>
    </Fragment>
  );
};

export default QueryHistoryEmptyState;
