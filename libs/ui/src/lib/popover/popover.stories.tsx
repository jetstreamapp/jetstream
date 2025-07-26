import { css } from '@emotion/react';
import { Meta, Story } from '@storybook/react';
import { useRef } from 'react';
import Grid from '../grid/Grid';
import GridCol from '../grid/GridCol';
import Icon from '../widgets/Icon';
import PopoverComponent, { PopoverProps, PopoverRef } from './Popover';

export default {
  title: 'overlays/Popover',
  component: PopoverComponent,
  argTypes: {
    size: {
      options: ['small', 'medium', 'large', 'full-width'],
    },
    placement: {
      options: [
        'top',
        'bottom',
        'right',
        'left',
        'auto',
        'top-start',
        'top-end',
        'bottom-start',
        'bottom-end',
        'right-start',
        'right-end',
        'left-start',
        'left-end',
        'auto',
        'auto-start',
        'auto-end',
      ],
    },
    footer: { control: false },
    header: { control: false },
    content: { control: false },
    buttonProps: { control: false },
    children: { control: false },
    onChange: { action: 'onChange' },
  },
  args: {
    inverseIcons: false,
    content: (
      <p>
        Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore.
        <button className="slds-button" title="Learn More">
          Learn More
        </button>
      </p>
    ),
    buttonProps: { className: 'slds-button slds-button--neutral' },
    children: 'Click Me to Open',
  },
} as Meta;

// export default {
//   title: 'Popover',
//   component: Popover,
// };

const Template: Story<PopoverProps> = ({ children, ...args }) => (
  <div
    css={css`
      height: 600px;
      width: 1000px;
    `}
  >
    <div className="slds-align_absolute-center w-100 h-100">
      <PopoverComponent {...args}>{children}</PopoverComponent>
    </div>
  </div>
);

const ScrollableContainerTemplate: Story<PopoverProps> = ({ children, ...args }) => (
  <div
    css={css`
      margin: 200px;
      height: 400px;
      width: 400px;
      overflow: scroll;
    `}
  >
    <div
      css={css`
        height: 600px;
        width: 600px;
        background-color: #b7b7b7;
      `}
    >
      <div className="slds-align_absolute-center w-100 h-100">
        <PopoverComponent {...args}>{children}</PopoverComponent>
      </div>
    </div>
  </div>
);

const TemplateWithOutsideControl: Story<PopoverProps> = ({ children, ...args }) => {
  const ref = useRef<PopoverRef>(null);

  return (
    <div
      css={css`
        height: 600px;
        width: 1000px;
      `}
    >
      <div className="slds-align_absolute-center w-100 h-100">
        <Grid vertical>
          <div className="slds-m-bottom_large slds-grid">
            <div>
              <button className="slds-button slds-button_neutral slds-m-right_small" onClick={() => ref.current.toggle()}>
                toggle (does not really work since outside click closes)
              </button>
            </div>
            <div>
              <button className="slds-button slds-button_neutral slds-m-right_small" onClick={() => ref.current.open()}>
                open
              </button>
            </div>
            <div>
              <button className="slds-button slds-button_neutral slds-m-right_small" onClick={() => ref.current.close()}>
                close (does not really work since outside click closes)
              </button>
            </div>
          </div>
          <PopoverComponent {...args} ref={ref}>
            {children}
          </PopoverComponent>
        </Grid>
      </div>
    </div>
  );
};

export const Popover = Template.bind({});

export const PopoverInScrollableContainer = ScrollableContainerTemplate.bind({});
PopoverInScrollableContainer.args = {
  omitPortal: true,
};

export const PopoverFromIcon = Template.bind({});
PopoverFromIcon.args = {
  buttonProps: {
    className:
      'slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__notifications slds-global-actions__item-action',
    ['aria-live']: 'assertive',
    ['aria-atomic']: 'true',
  },
  children: <Icon type="utility" icon="notification" className="slds-button__icon slds-global-header__icon" omitContainer />,
};

export const PopoverWithHeaderState = Template.bind({});
PopoverWithHeaderState.argsTypes = {
  size: {
    containerClassName: ['slds-popover_error', 'slds-popover_warning'],
    defaultValue: 'slds-popover_error',
  },
};
PopoverWithHeaderState.args = {
  inverseIcons: true,
  containerClassName: 'slds-popover_error',
  header: (
    <header className="slds-popover__header">
      <div className="slds-media slds-media_center slds-has-flexi-truncate">
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
  ),
};

export const PopoverWithHeaderAndFooter = Template.bind({});
PopoverWithHeaderAndFooter.args = {
  header: (
    <header className="slds-popover__header slds-p-vertical_medium">
      <h2 id="dialog-heading-id-3" className="slds-text-heading_medium">
        Manage your channels
      </h2>
    </header>
  ),
  footer: (
    <footer className="slds-popover__footer">
      <Grid verticalAlign="center">
        <GridCol className="slds-text-title">Step 2 of 4</GridCol>
        <GridCol bump="left">
          <button className="slds-button slds-button_brand">Next</button>
        </GridCol>
      </Grid>
    </footer>
  ),
};

export const PopoverWithWalkthrough = Template.bind({});
PopoverWithWalkthrough.args = {
  containerClassName: 'slds-popover_walkthrough',
  inverseIcons: true,
  header: (
    <header className="slds-popover__header slds-p-vertical_medium">
      <h2 id="dialog-heading-id-3" className="slds-text-heading_medium">
        Manage your channels
      </h2>
    </header>
  ),
  footer: (
    <footer className="slds-popover__footer">
      <Grid verticalAlign="center">
        <GridCol className="slds-text-title">Step 2 of 4</GridCol>
        <GridCol bump="left">
          <button className="slds-button slds-button_brand">Next</button>
        </GridCol>
      </Grid>
    </footer>
  ),
};

export const PopoverWithOutsideControl = TemplateWithOutsideControl.bind({});
