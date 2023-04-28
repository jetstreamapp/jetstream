import { Maybe } from '@jetstream/types';
import { Icon, Tooltip } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface TooltipCopyToClipboardProps {
  content: Maybe<string | JSX.Element>;
}

export const TooltipCopyToClipboard: FunctionComponent<TooltipCopyToClipboardProps> = (content) => {
  console.log('content', content.content);
  console.log('content', content);
  return (
    <Tooltip content={content.content}>
      <Icon
        type="utility"
        icon="error"
        description="Failed"
        title="Failed"
        className="slds-button__icon slds-text-color_error slds-p-right_x-small"
      />
    </Tooltip>
  );
};
export default TooltipCopyToClipboard;

{
  /* <CopyToClipboard
icon={{ type: 'utility', icon: 'error', description: 'Click to copy to clipboard' }}
content="test"
className="slds-text-color_error slds-p-right_x-small"
/> */
}
