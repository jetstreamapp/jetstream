import { Maybe } from '@jetstream/types';
import { CopyToClipboard, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';

export interface TooltipCopyToClipboardProps {
  content: Maybe<string | JSX.Element>;
}

export const TooltipCopyToClipboard: FunctionComponent<TooltipCopyToClipboardProps> = (content) => {
  const [displayContent, setDisplayContent] = useState(content.content);
  const [copiedState, setCopiedState] = useState(false);

  const handleCopied = (data) => {
    setCopiedState(data);
  };

  useEffect(() => {
    if (!copiedState) {
      setDisplayContent(content.content);
    } else {
      setDisplayContent('Copied to Clipboard');
    }
  }, [handleCopied]);

  return (
    <Tooltip content={displayContent}>
      <CopyToClipboard
        icon={{ type: 'utility', icon: 'error', description: 'Click to copy to clipboard' }}
        content="test"
        className="slds-text-color_error slds-p-right_x-small"
        copied={handleCopied}
      />
    </Tooltip>
  );
};
export default TooltipCopyToClipboard;
