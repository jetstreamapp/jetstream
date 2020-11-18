import { boolean, select, text } from '@storybook/addon-knobs';
import uniqueId from 'lodash/uniqueId';
import React, { Fragment } from 'react';
import HelpText from './HelpText';
import Icon from './Icon';
import Spinner from './Spinner';
import Tooltip from './Tooltip';
import Badge from './Badge';
import Pill from './Pill';
import { action } from '@storybook/addon-actions';
import CopyToClipboard from './CopyToClipboard';
import { IconName } from '@jetstream/icon-factory';

export default {
  title: 'Widgets',
};

export const helpText = () => <HelpText id={uniqueId('help-text')} content="Some help text" />;

export const spinnerFullPage = () => <Spinner hasContainer={boolean('hasContainer', true)} inline={boolean('inline', false)} />;

export const spinnerInRelativeContainer = () => (
  <div className="slds-is-relative" style={{ width: 100, height: 100 }}>
    <Spinner hasContainer={boolean('hasContainer', true)} inline={boolean('inline', false)} />
  </div>
);

export const basicIcon = () => (
  <div className="slds-is-grid">
    <Icon
      type={select(
        'type',
        {
          action: 'action',
          custom: 'custom',
          doctype: 'doctype',
          standard: 'standard',
          utility: 'utility',
        },
        'utility'
      )}
      icon={text('icon', 'add') as IconName}
      omitContainer={boolean('omitContainer', false)}
      containerClassname={text('containerClassname', undefined)}
      className={text('className', undefined)}
      title={text('title', 'title for accessibility')}
      description={text('description', 'description for accessibility')}
    />
  </div>
);

export const iconWithCustomClass = () => (
  <div className="slds-is-grid">
    <Icon
      type={select(
        'type',
        {
          action: 'action',
          custom: 'custom',
          doctype: 'doctype',
          standard: 'standard',
          utility: 'utility',
        },
        'custom'
      )}
      icon={text('icon', 'custom5') as IconName}
      omitContainer={boolean('omitContainer', false)}
      containerClassname={text('containerClassname', 'slds-icon-custom-custom5')}
      className={text('className', undefined)}
      title={text('title', 'title for accessibility')}
      description={text('description', 'description for accessibility')}
    />
  </div>
);

export const iconWithCircleContainer = () => (
  <div className="slds-is-grid">
    <Icon
      type={select(
        'type',
        {
          action: 'action',
          custom: 'custom',
          doctype: 'doctype',
          standard: 'standard',
          utility: 'utility',
        },
        'action'
      )}
      icon={text('icon', 'description') as IconName}
      omitContainer={boolean('omitContainer', false)}
      containerClassname={text('containerClassname', 'slds-icon_container_circle slds-icon-action-description')}
      className={text('className', undefined)}
      title={text('title', 'title for accessibility')}
      description={text('description', 'description for accessibility')}
    />
  </div>
);

export const iconSuccess = () => (
  <div className="slds-is-grid">
    <Icon
      type={select(
        'type',
        {
          action: 'action',
          custom: 'custom',
          doctype: 'doctype',
          standard: 'standard',
          utility: 'utility',
        },
        'utility'
      )}
      icon={text('icon', 'announcement') as IconName}
      omitContainer={boolean('omitContainer', false)}
      containerClassname={text('containerClassname', 'slds-icon-utility-announcement')}
      className={text('className', 'slds-icon-text-success')}
      title={text('title', 'title for accessibility')}
      description={text('description', 'description for accessibility')}
    />
  </div>
);

export const copyToClipboard = () => (
  <CopyToClipboard
    className={text('className', 'slds-m-left--xx-small')}
    icon={{ type: 'utility', icon: text('icon', 'copy') as IconName, description: text('iconDescription', 'copy to clipboard') }}
    size={select(
      'size',
      {
        none: undefined,
        xSmall: 'x-small',
        small: 'small',
        large: 'large',
      },
      undefined
    )}
    container={boolean('container', false)}
    skipTransitionIcon={boolean('skipTransitionIcon', false)}
    containerSize={select(
      'containerSize',
      {
        none: undefined,
        xxxSmall: 'xxx-small',
        xSmall: 'x-small',
        Small: 'small',
      },
      undefined
    )}
    content={text('content', 'content to copy')}
    copied={action('copied')}
  />
);

export const tooltipBasic = () => (
  <Tooltip content={text('content', 'This is the tooltip content!')}>
    {text('element', 'This is the item with a tooltip surrounding it')}
  </Tooltip>
);

export const tooltipFromIcon = () => (
  <Tooltip content={text('content', 'This is the tooltip content!')}>
    <Icon type="utility" icon="settings" />
  </Tooltip>
);

export const tooltipWithCustomContent = () => (
  <Tooltip
    content={
      <span style={{ fontSize: '1rem' }}>
        <strong>Fancy</strong> custom tooltip content!
      </span>
    }
  >
    {text('element', 'This is the item with a tooltip surrounding it')}
  </Tooltip>
);

export const badges = () => (
  <Fragment>
    <Badge>Default Badge</Badge>
    <Badge type="inverse">Inverse Badge</Badge>
    <Badge type="light">Light Badge</Badge>
    <Badge type="success">Success Badge</Badge>
    <Badge type="warning">Warning Badge</Badge>
    <Badge type="error">Error Badge</Badge>
    <Badge type="error">
      <span className="slds-badge__icon slds-badge__icon_left">
        <Icon
          type="utility"
          icon="error"
          className="slds-icon slds-icon_xx-small"
          containerClassname="slds-icon_container slds-icon-utility-error"
        />
      </span>
      Badge With Left Icon
    </Badge>
    <Badge type="light">
      Badge With Right Icon
      <span className="slds-badge__icon slds-badge__icon_right">
        <Icon
          type="utility"
          icon="moneybag"
          className="slds-icon slds-icon_xx-small"
          containerClassname="slds-icon_container slds-icon-utility-moneybag slds-current-color"
        />
      </span>
    </Badge>
  </Fragment>
);

export const pill = () => (
  <Fragment>
    <Pill title="My Pill :)" onRemove={action('onRemove')}>
      My Pill
    </Pill>
    <Pill>My Pill (can't be removed)</Pill>
  </Fragment>
);
