import { IconObj } from '@jetstream/icon-factory';
import { SizeXSmallSmallLarge, SizeXXSmallXSmallSmall } from '@jetstream/types';
import classNames from 'classnames';
import React, { FunctionComponent, useEffect, useState } from 'react';
import useClipboard from 'react-use-clipboard';
import Icon from './Icon';

export interface CopyToClipboardProps {
  className?: string;
  type?: 'icon' | 'button';
  iconClassName?: string;
  icon?: IconObj;
  content: string;
  size?: SizeXSmallSmallLarge;
  container?: boolean;
  containerSize?: SizeXXSmallXSmallSmall;
  skipTransitionIcon?: boolean;
  disabled?: boolean;
  copied?: (isActive: boolean) => void;
}

export const CopyToClipboard: FunctionComponent<CopyToClipboardProps> = ({
  className,
  type = 'icon',
  icon = { type: 'utility', icon: 'copy', description: 'copy to clipboard' },
  size,
  container,
  containerSize,
  skipTransitionIcon,
  content,
  disabled,
  copied,
}) => {
  const [isCopied, setClipboard] = useClipboard(content, {
    successDuration: 1500,
  });
  const [currentIcon, setCurrentIcon] = useState(icon);

  function handleCopy() {
    setClipboard();
  }

  useEffect(() => {
    copied && copied(isCopied);
    if (!skipTransitionIcon && isCopied) {
      setCurrentIcon({ ...icon, icon: 'check' });
    } else if (currentIcon !== icon) {
      setCurrentIcon(icon);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCopied]);

  return (
    <button
      className={classNames(
        'slds-button',
        type === 'icon' ? 'slds-button_icon' : '',
        type === 'icon' && container ? 'slds-button_icon-border' : undefined,
        type === 'icon' && container && containerSize ? `slds-button_icon-${containerSize}` : undefined,
        className
      )}
      disabled={disabled || (!skipTransitionIcon && isCopied)}
      onClick={() => handleCopy()}
    >
      <Icon
        className={classNames(
          'slds-button__icon',
          type === 'button' ? 'slds-button__icon_left' : '',
          size ? `slds-button__icon_${size}` : undefined
        )}
        type={currentIcon.type}
        icon={currentIcon.icon}
        description={currentIcon.description}
      />
      {type === 'button' ? 'Copy to Clipboard' : null}
    </button>
  );
};

export default CopyToClipboard;
