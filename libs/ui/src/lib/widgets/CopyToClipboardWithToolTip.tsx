import { FunctionComponent, useState } from 'react';
import { CopyToClipboard, CopyToClipboardProps } from './CopyToClipboard';
import { Tooltip } from './Tooltip';

export interface CopyToClipboardWithToolTipProps extends Omit<CopyToClipboardProps, 'copied'> {
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
