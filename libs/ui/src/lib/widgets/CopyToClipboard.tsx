import React, { FunctionComponent, useState, useEffect } from 'react';
import { IconObj, SizeXSmallSmallLarge, SizeXXSmallXSmallSmall } from '@jetstream/types';
import Icon from './Icon';
import classNames from 'classnames';
import useClipboard from 'react-use-clipboard';

export interface CopyToClipboardProps {
  className?: string;
  icon?: IconObj;
  content: string;
  size?: SizeXSmallSmallLarge;
  container?: boolean;
  containerSize?: SizeXXSmallXSmallSmall;
}

export const CopyToClipboard: FunctionComponent<CopyToClipboardProps> = ({
  className,
  icon = { type: 'utility', icon: 'copy', description: 'copy to clipboard' },
  size,
  container,
  containerSize,
  content,
}) => {
  const [isCopied, setClipboard] = useClipboard(content, {
    successDuration: 1500,
  });
  const [currentIcon, setCurrentIcon] = useState(icon);

  function handleCopy() {
    setClipboard();
  }

  useEffect(() => {
    if (isCopied) {
      setCurrentIcon({ ...icon, icon: 'check' });
    } else if (currentIcon !== icon) {
      setCurrentIcon(icon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCopied]);

  return (
    <button
      className={classNames(
        'slds-button slds-button_icon',
        container ? 'slds-button_icon-border' : undefined,
        container && containerSize ? `slds-button_icon-${containerSize}` : undefined,
        className
      )}
      disabled={isCopied}
      onClick={() => handleCopy()}
    >
      <Icon
        className={classNames('slds-button__icon', size ? `slds-button__icon_${size}` : undefined)}
        type={currentIcon.type}
        icon={currentIcon.icon}
        description={currentIcon.description}
      />
    </button>
  );
};

export default CopyToClipboard;
