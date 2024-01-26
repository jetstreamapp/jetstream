import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../../query.state';

export interface TabTitleActivityIndicatorProps {
  type: 'standard' | 'advanced';
}

export const TabTitleActivityIndicator = ({ type }: TabTitleActivityIndicatorProps) => {
  const dirtySections = useRecoilValue(fromQueryState.hasQueryOptionsConfigured);

  if (type === 'standard' && dirtySections.standard) {
    return <span className="slds-m-left_xx-small">({dirtySections.standard})</span>;
  } else if (type === 'advanced' && dirtySections.advanced) {
    return <span className="slds-m-left_xx-small">({dirtySections.advanced})</span>;
  }

  return null;
};

export default TabTitleActivityIndicator;
