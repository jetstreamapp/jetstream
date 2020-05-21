/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable no-script-url */
/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import { Fragment } from 'react';
import Icon from '../widgets/Icon';
import Popover from './Popover';

export default {
  title: 'Popover',
  component: Popover,
};

export const base = () => (
  <Fragment>
    <div>
      <Popover
        inverseIcons={boolean('inverseIcons', false)}
        containerClassName={text('containerClassName', '')}
        content={
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
            <a href="javascript:void(0);" title="Learn More">
              Learn More
            </a>
          </p>
        }
        onClose={action('onClose')}
      >
        <button className="slds-button slds-button--neutral">Click Me to Open auto</button>
      </Popover>
    </div>
    <div
      css={css`
        margin-left: 50%;
      `}
    >
      <Popover
        inverseIcons={boolean('inverseIcons', false)}
        containerClassName={text('containerClassName', '')}
        placement="bottom"
        content={
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
            <a href="javascript:void(0);" title="Learn More">
              Learn More
            </a>
          </p>
        }
        onClose={action('onClose')}
      >
        <button className="slds-button slds-button--neutral">Click Me to Open bottom</button>
      </Popover>
    </div>
    <div
      css={css`
        margin-left: 25%;
      `}
    >
      <Popover
        inverseIcons={boolean('inverseIcons', false)}
        containerClassName={text('containerClassName', '')}
        placement="left"
        content={
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
            <a href="javascript:void(0);" title="Learn More">
              Learn More
            </a>
          </p>
        }
        onClose={action('onClose')}
      >
        <button className="slds-button slds-button--neutral">Click Me to Open left</button>
      </Popover>
    </div>
    <div
      css={css`
        margin-top: 20%;
        margin-left: 25%;
      `}
    >
      <Popover
        inverseIcons={boolean('inverseIcons', false)}
        containerClassName={text('containerClassName', '')}
        placement="top"
        content={
          <p>
            Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
            <a href="javascript:void(0);" title="Learn More">
              Learn More
            </a>
          </p>
        }
        onClose={action('onClose')}
      >
        <button className="slds-button slds-button--neutral">Click Me to Open top - BROKEN ;(</button>
      </Popover>
    </div>
  </Fragment>
);

export const withHeader = () => (
  <Popover
    containerClassName={text('containerClassName', 'slds-popover_error')}
    inverseIcons={boolean('inverseIcons', true)}
    header={
      <header className="slds-popover__header">
        <div className="slds-media slds-media_center slds-has-flexi-truncate ">
          <div className="slds-media__figure">
            <Icon
              type="utility"
              icon="error"
              className="slds-icon slds-icon_x-small"
              containerClassname="slds-icon_container slds-icon-utility-error"
            />
          </div>
          <div className="slds-media__body">
            <h2 className="slds-truncate slds-text-heading_medium" id="dialog-heading-id-1" title="Resolve error">
              Resolve error
            </h2>
          </div>
        </div>
      </header>
    }
    content={
      <p>
        Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
        <a href="javascript:void(0);" title="Learn More">
          Learn More
        </a>
      </p>
    }
  >
    <button className="slds-button slds-button--brand">Click Me to Open</button>
  </Popover>
);

export const withHeaderAndFooter = () => (
  <Popover
    containerClassName={text('containerClassName', 'slds-popover_walkthrough')}
    inverseIcons={boolean('inverseIcons', true)}
    header={
      <header className="slds-popover__header slds-p-vertical_medium">
        <h2 id="dialog-heading-id-3" className="slds-text-heading_medium">
          Manage your channels
        </h2>
      </header>
    }
    footer={
      <footer className="slds-popover__footer">
        <div className="slds-grid slds-grid_vertical-align-center">
          <span className="slds-text-title">Step 2 of 4</span>
          <button className="slds-button slds-button_brand slds-col_bump-left">Next</button>
        </div>
      </footer>
    }
    content={
      <p>
        Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
        <a href="javascript:void(0);" title="Learn More">
          Learn More
        </a>
      </p>
    }
  >
    <button className="slds-button slds-button_icon" title="Settings">
      <Icon type="utility" icon="settings" className="slds-button__icon" omitContainer />
    </button>
  </Popover>
);

// <PopoverContainer
// nubbinPosition={select(
//   'nubbinPosition',
//   {
//     Left: 'left',
//     LeftTop: 'left-top',
//     LeftBottom: 'left-bottom',
//     Top: 'top',
//     TopLeft: 'top-left',
//     TopRight: 'top-right',
//     Right: 'right',
//     RightTop: 'right-top',
//     RightBottom: 'right-bottom',
//     Bottom: 'bottom',
//     BottomLeft: 'bottom-left',
//     BottomRight: 'bottom-right',
//     None: undefined,
//   },
//   'bottom'
// )}
// containerClassName={text('containerClassName', '')}
// inverseIcons={boolean('inverseIcons', false)}
// >
// <p>
//   Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
//   <a href="javascript:void(0);" title="Learn More">
//     Learn More
//   </a>
// </p>
// </PopoverContainer>
