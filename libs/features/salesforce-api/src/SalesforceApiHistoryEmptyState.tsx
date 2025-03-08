import { EmptyState } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { WhichOrgType } from './SalesforceApiHistoryModal';

export interface SalesforceApiHistoryEmptyStateProps {
  whichOrg: WhichOrgType;
}

export const SalesforceApiHistoryEmptyState: FunctionComponent<SalesforceApiHistoryEmptyStateProps> = ({ whichOrg }) => {
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');

  useEffect(() => {
    if (whichOrg === 'SELECTED') {
      setText1(`You don't have any history for the selected org.`);
    } else {
      setText1(`You don't have any history.`);
    }
    setText2(`Come back once you have performed some requests.`);
  }, [whichOrg]);

  return <EmptyState headline={text1} subHeading={text2}></EmptyState>;
};
