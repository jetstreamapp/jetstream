import { Badge } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtomValue } from 'jotai';

export const QueryUsingScopeTitleSummary = () => {
  const usingScope = useAtomValue(fromQueryState.queryUsingScopeState);

  if (!usingScope) {
    return null;
  }

  return <Badge className="slds-m-left_x-small slds-truncate">{usingScope}</Badge>;
};

export default QueryUsingScopeTitleSummary;
