import { IconObj } from '@jetstream/icon-factory';
import { CopyToClipboard, CopyToClipboardProps, Tooltip } from '@jetstream/ui';
import { FunctionComponent, useState } from 'react';

export interface CopyToClipboardWithToolTipProps extends Omit<CopyToClipboardProps, 'copied' | 'content'> {
  content: string;
  className?: string;
  icon?: IconObj;
  copiedMessage?: string;
}

export const CopyToClipboardWithToolTip: FunctionComponent<CopyToClipboardWithToolTipProps> = ({
  content,
  copiedMessage = 'Copied to clipboard',
  ...copyToClipboardProps
}) => {
  const [displayContent, setDisplayContent] = useState(content);

  const handleCopied = (active: boolean) => {
    setDisplayContent(active ? copiedMessage : content);
  };

  return (
    <Tooltip content={displayContent}>
      <CopyToClipboard {...copyToClipboardProps} content={content} copied={handleCopied} />
    </Tooltip>
  );
};
export default CopyToClipboardWithToolTip;
