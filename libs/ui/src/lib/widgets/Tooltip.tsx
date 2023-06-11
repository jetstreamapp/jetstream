import { css } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import Tippy, { TippyProps } from '@tippyjs/react';
import { FunctionComponent, MouseEvent, useState } from 'react';

export interface TooltipProps {
  /** @deprecated This is not used in the component */
  id?: string;
  className?: string;
  content: Maybe<string | JSX.Element>;
  /**
   * number controls hide delay in ms
   * array controls show and hide delay, [openDelay, closeDelay]
   */
  delay?: TippyProps['delay'];
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  children?: React.ReactNode;
}

type LazyTippyProps = TippyProps;

const LazyTippy = (props: LazyTippyProps) => {
  const [mounted, setMounted] = useState(false);

  const lazyPlugin = {
    fn: () => ({
      onMount: () => setMounted(true),
      onHidden: () => setMounted(false),
    }),
  };

  const computedProps = { ...props };
  computedProps.plugins = [lazyPlugin, ...(props.plugins || [])];

  if (props.render) {
    const render = props.render; // let TypeScript safely derive that render is not undefined
    computedProps.render = (...args) => (mounted ? render(...args) : '');
  } else {
    computedProps.content = mounted ? props.content : '';
  }

  return <Tippy {...computedProps} />;
};

export const Tooltip: FunctionComponent<TooltipProps> = ({ className, content, delay, onClick, children }) => {
  const [visible, setVisible] = useState(false);
  const [arrowElement, setArrowElement] = useState<HTMLElement | null>(null);

  return (
    <LazyTippy
      onHide={() => setVisible(false)}
      onShow={() => {
        content && setVisible(true);
      }}
      hideOnClick={false}
      delay={delay}
      allowHTML
      popperOptions={{
        modifiers: [
          {
            name: 'arrow',
            options: {
              element: arrowElement,
            },
          },
        ],
      }}
      render={(attrs) => {
        return (
          <div
            className="slds-popover slds-popover_tooltip"
            tabIndex={-1}
            role="tooltip"
            {...attrs}
            css={css`
              ${visible ? '' : 'display: none;'}

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
          >
            <div className="slds-popover__body">{content}</div>
            <div
              className="popover-arrow"
              css={css`
                position: absolute;
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
              ref={setArrowElement}
            ></div>
          </div>
        );
      }}
    >
      <span className={className} tabIndex={0} onClick={onClick}>
        {children}
      </span>
    </LazyTippy>
  );
};

export default Tooltip;
