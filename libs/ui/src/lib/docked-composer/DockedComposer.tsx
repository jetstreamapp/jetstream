import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { forwardRef, Fragment, useImperativeHandle, useState } from 'react';
import Icon from '../widgets/Icon';

// https://www.lightningdesignsystem.com/components/docked-composer/?modifiers=.slds-is-open&variant=base

export interface DockedComposerRef {
  setIsOpen(value: boolean): void;
}

export interface DockedComposerProps {
  id?: string;
  label: string;
  iconOverride?: JSX.Element;
  initOpenState?: boolean;
  allowMinimize?: boolean;
  // allowMaximize?: boolean;
  allowClose?: boolean;
  footer?: JSX.Element;
  onClose?: () => void;
  children?: React.ReactNode;
}

export const DockedComposer = forwardRef<any, DockedComposerProps>(
  (
    {
      id = uniqueId('docked-composer-'),
      label,
      iconOverride,
      initOpenState = false,
      allowMinimize = false,
      // allowMaximize = false,
      allowClose = true,
      footer,
      onClose,
      children,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(initOpenState);
    const [hasOpened, setHasOpened] = useState(initOpenState);
    // classname can be replaced with "slds-modal slds-fade-in-open slds-docked-composer-modal" to turn into special modal, some other classes change also

    useImperativeHandle<any, DockedComposerRef>(ref, () => {
      return {
        setIsOpen: (value) => setIsOpen(value),
      };
    });

    function toggleOpen(event: React.MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
      if (allowMinimize) {
        setIsOpen(!isOpen);
        if (!hasOpened && !isOpen) {
          setHasOpened(true);
        }
      }
    }

    function handleClose(event: React.MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
      onClose && onClose();
    }

    return (
      <div className="slds-docked_container" style={{ zIndex: 1 }}>
        <section
          className={classNames('slds-docked-composer slds-grid slds-grid_vertical', { 'slds-is-open': isOpen, 'slds-is-closed': !isOpen })}
          role="dialog"
          aria-labelledby={id}
          aria-describedby={`${id}-content`}
        >
          <header className="slds-docked-composer__header slds-grid slds-shrink-none" aria-live="assertive" onClick={toggleOpen}>
            <div className="slds-media slds-media_center slds-no-space">
              <div className="slds-media__figure slds-m-right_x-small">
                {!iconOverride && <Icon type="brand" icon="jetstream" className="slds-icon slds-icon_small slds-icon-text-default" />}
                {!!iconOverride && iconOverride}
              </div>
              <div className="slds-media__body">
                {!isOpen && <span className="slds-assistive-text">Minimized</span>}
                <h2 className="slds-truncate" id={id} title={label}>
                  {label}
                </h2>
              </div>
            </div>
            <div className="slds-col_bump-left slds-shrink-none">
              {allowMinimize && isOpen && (
                <button className="slds-button slds-button_icon slds-button_icon" title="Minimize window" onClick={toggleOpen}>
                  <Icon
                    type="utility"
                    icon="minimize_window"
                    className="slds-button__icon"
                    omitContainer
                    description="Minimize Composer Panel"
                  />
                </button>
              )}
              {/* Turns into modal if maximized */}
              {/* {allowMaximize && <button className="slds-button slds-button_icon slds-button_icon" title="Expand Composer"> <Icon type="utility" icon="expand_alt" className='slds-button__icon' omitContainer description='Expand Composer Panel' /> </button>} */}
              {allowClose && (
                <button className="slds-button slds-button_icon slds-button_icon" title="Close" onClick={handleClose}>
                  <Icon type="utility" icon="close" className="slds-button__icon" omitContainer description="Close Composer Panel" />
                </button>
              )}
            </div>
          </header>
          {/* Content is retained on minimize in case there is any state associated with child component */}
          {(isOpen || hasOpened) && (
            <Fragment>
              <div className="slds-docked-composer__body" id={`${id}-content`}>
                {children}
              </div>
              {footer && (
                <footer className="slds-docked-composer__footer slds-shrink-none">
                  {footer}
                  {/* Example */}
                  {/* <div className="slds-col_bump-left slds-text-align_right"> <button className="slds-button slds-button_brand">Action</button> </div> */}
                </footer>
              )}
            </Fragment>
          )}
        </section>
      </div>
    );
  }
);

export default DockedComposer;
