import { Icon, Tooltip } from '@jetstream/ui';
import { Fragment } from 'react';

export function AccordionTitle({ titleText, hasError }: { titleText: string; hasError: boolean }) {
  if (hasError) {
    return (
      <Fragment>
        {titleText}{' '}
        <Tooltip content="There are configuration errors">
          <Icon
            className="slds-icon slds-icon_x-small slds-icon-text-warning slds-m-left_xx-small"
            type="utility"
            icon="warning"
            description="Fix configuration errors"
          />
        </Tooltip>
      </Fragment>
    );
  }
  return titleText;
}
