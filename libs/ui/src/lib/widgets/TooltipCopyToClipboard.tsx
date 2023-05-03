import { IconObj } from '@jetstream/icon-factory';
import { CopyToClipboard, CopyToClipboardProps, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';

export interface TooltipCopyToClipboardProps extends Omit<CopyToClipboardProps, 'copied' | 'content'> {
  toolTipContent: string;
  className?: string;
  icon?: IconObj;
  copiedMessage?: string;
}

export const TooltipCopyToClipboard: FunctionComponent<TooltipCopyToClipboardProps> = ({
  toolTipContent,
  copiedMessage = 'Copied to clipboard',
  ...copyToClipboardProps
}) => {
  const [displayContent, setDisplayContent] = useState(toolTipContent);

  const handleCopied = (active: boolean) => {
    setDisplayContent(active ? copiedMessage : toolTipContent);
  };

  return (
    <Tooltip content={displayContent}>
      <CopyToClipboard {...copyToClipboardProps} content={toolTipContent} copied={handleCopied} />
    </Tooltip>
  );
};
export default TooltipCopyToClipboard;
