import { css } from '@emotion/react';
import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { Maybe } from '@jetstream/types';
import { FunctionComponent, MouseEvent, useEffect, useRef, useState } from 'react';
import { usePortalContext } from '../modal/PortalContext';

export interface TooltipProps {
  /** @deprecated This is not used in the component */
  id?: string;
  className?: string;
  content: Maybe<string | React.ReactNode>;
  /**
   * number controls hide delay in ms
   * array controls show and hide delay, [openDelay, closeDelay]
   */
  openDelay?: number;
  closeDelay?: number;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  children?: React.ReactNode;
}

export const Tooltip: FunctionComponent<TooltipProps> = ({ className, content, openDelay, closeDelay, onClick, children }) => {
  const { portalRoot } = usePortalContext();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const arrowRef = useRef(null);

  const { refs, floatingStyles, context, placement, middlewareData } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top',
    middleware: [
      offset(8),
      flip(),
      shift({ padding: 8 }),
      arrow({
        element: arrowRef,
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const { x: arrowX, y: arrowY } = middlewareData.arrow || {};

  const hover = useHover(context, {
    delay: {
      open: openDelay,
      close: closeDelay,
    },
  });
  const role = useRole(context, { role: 'tooltip' });
  const dismiss = useDismiss(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([hover, role, dismiss]);

  useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setMounted(false);
      }, closeDelay || 0);
      return () => clearTimeout(timer);
    }
  }, [open, closeDelay]);

  const shouldShow = open && content;

  const tooltipContent = mounted && !!content && shouldShow && (
    <div
      ref={refs.setFloating}
      className="slds-popover slds-popover_tooltip"
      style={floatingStyles}
      {...getFloatingProps()}
      css={css`
        width: max-content;
        &[data-placement^='right'] {
          .popover-arrow {
            left: -0.5rem;
            &::after {
              box-shadow: -1px 1px 2px 0 rgb(0 0 0 / 16%);
            }
          }
        }

        &[data-placement^='left'] {
          .popover-arrow {
            right: -0.5rem;
            &::after {
              box-shadow: 1px -1px 2px 0 rgb(0 0 0 / 16%);
            }
          }
        }

        &[data-placement^='top'] {
          .popover-arrow {
            bottom: -0.5rem;
            &::after {
              box-shadow: 2px 2px 4px 0 rgb(0 0 0 / 16%);
            }
          }
        }

        &[data-placement^='bottom'] {
          .popover-arrow {
            top: -0.5rem;
            &::after {
              box-shadow: -1px -1px 0 0 rgb(0 0 0 / 16%);
            }
          }
        }
      `}
      data-placement={placement}
    >
      <div className="slds-popover__body">{content}</div>
      <div
        className="popover-arrow"
        ref={arrowRef}
        style={{
          position: 'absolute',
          left: arrowX != null ? `${arrowX}px` : '',
          top: arrowY != null ? `${arrowY}px` : '',
        }}
        css={css`
          width: 1rem;
          height: 1rem;
          background: inherit;
          visibility: hidden;
          &::before {
            visibility: visible;
            content: '';
            transform: rotate(45deg);
            position: absolute;
            width: 1rem;
            height: 1rem;
            background: inherit;
          }
          &::after {
            visibility: visible;
            content: '';
            transform: rotate(45deg);
            position: absolute;
            width: 1rem;
            height: 1rem;
            background-color: inherit;
          }
        `}
      ></div>
    </div>
  );

  return (
    <>
      <span ref={refs.setReference} className={className} onClick={onClick} {...getReferenceProps()}>
        {children}
      </span>
      {/* FIXME: fix deprecation */}
      {tooltipContent && (
        <FloatingPortal root={portalRoot as null | React.MutableRefObject<HTMLElement | null>}>{tooltipContent}</FloatingPortal>
      )}
    </>
  );
};

export default Tooltip;
