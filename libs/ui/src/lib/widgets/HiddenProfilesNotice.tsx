import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { FunctionComponent } from 'react';
import ScopedNotification from '../scoped-notification/ScopedNotification';

export interface HiddenProfilesNoticeProps {
  className?: string;
  hiddenProfileCount: number;
}

/**
 * Explains why some profiles are missing from a profile list.
 * Salesforce profile filtering hides every profile except the user's own unless they have View All Profiles.
 */
export const HiddenProfilesNotice: FunctionComponent<HiddenProfilesNoticeProps> = ({ className, hiddenProfileCount }) => {
  if (hiddenProfileCount <= 0) {
    return null;
  }
  return (
    <ScopedNotification theme="warning" className={className}>
      <p className="slds-text-body_small">
        {formatNumber(hiddenProfileCount)} {pluralizeFromNumber('profile', hiddenProfileCount)} {hiddenProfileCount === 1 ? 'is' : 'are'}{' '}
        hidden because your Salesforce user does not have the <strong>View All Profiles</strong> permission.
      </p>
    </ScopedNotification>
  );
};

export default HiddenProfilesNotice;
