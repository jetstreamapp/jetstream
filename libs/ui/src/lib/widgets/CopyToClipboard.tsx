import { IconObj } from '@jetstream/icon-factory';
import { SizeXSmallSmallLarge, SizeXXSmallXSmallSmall } from '@jetstream/types';
import classNames from 'classnames';
import React, { Fragment, FunctionComponent, ReactNode, useEffect, useState } from 'react';
import useClipboard from 'react-use-clipboard';
import Icon from './Icon';

export interface CopyToClipboardProps {
  className?: string;
  buttonText?: string;
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
  children?: ReactNode;
}

export const CopyToClipboard: FunctionComponent<CopyToClipboardProps> = ({
  className,
  buttonText = 'Copy to Clipboard',
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

  function handleCopy(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const buttonEl = event.currentTarget;
    setClipboard();
    // The copy-to-clipboard library selects a temporary off-screen element to execute the copy and
    // then removes it, which drops focus on <body> — put focus back on the button
    buttonEl.focus();
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
    <Fragment>
      <button
        className={classNames(
          'slds-button',
          type === 'icon' ? 'slds-button_icon' : '',
          type === 'icon' && container ? 'slds-button_icon-border' : undefined,
          type === 'icon' && container && containerSize ? `slds-button_icon-${containerSize}` : undefined,
          className,
        )}
        disabled={disabled}
        onClick={handleCopy}
        type="button"
      >
        <Icon
          className={classNames(
            'slds-button__icon',
            type === 'button' ? 'slds-button__icon_left' : '',
            size ? `slds-button__icon_${size}` : undefined,
          )}
          type={currentIcon.type}
          icon={currentIcon.icon}
          // With visible text the icon is decorative — a description would double up the accessible
          // name ("copy to clipboard Copy to Clipboard")
          description={type === 'button' ? undefined : currentIcon.description}
        />
        {type === 'button' ? buttonText : null}
      </button>
      {/* The success checkmark is visual-only — announce the outcome (focus stays on the button). A
          SIBLING of the button: inside it, the status text became part of the button's accessible name */}
      <span role="status" aria-live="polite" className="slds-assistive-text">
        {isCopied ? 'Copied to clipboard' : ''}
      </span>
    </Fragment>
  );
};

export default CopyToClipboard;
