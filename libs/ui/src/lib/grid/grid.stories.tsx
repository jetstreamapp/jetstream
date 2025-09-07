import { boolean, number, select } from '@storybook/addon-knobs';
import React from 'react';
import Grid from './Grid';
import GridCol from './GridCol';

export default {
  title: 'Grid',
  component: Grid,
};

export const grid = () => (
  <Grid
    gutters={boolean('gutters', false)}
    guttersDirect={boolean('guttersDirect', false)}
    guttersSize={select(
      'guttersSize',
      {
        'xxx-small': 'xxx-small',
        'xx-small': 'xx-small',
        'x-small': 'x-small',
        small: 'small',
        medium: 'medium',
        large: 'large',
        'x-large': 'x-large',
        'xx-large': 'xx-large',
      },
      undefined,
    )}
    pullPadded={boolean('pullPadded', false)}
    pullPaddedSize={select(
      'pullPaddedSize',
      {
        'xxx-small': 'xxx-small',
        'xx-small': 'xx-small',
        'x-small': 'x-small',
        small: 'small',
        medium: 'medium',
        large: 'large',
        'x-large': 'x-large',
        'xx-large': 'xx-large',
      },
      undefined,
    )}
    align={select(
      'align',
      {
        center: 'center',
        space: 'space',
        spread: 'spread',
        end: 'end',
      },
      undefined,
    )}
    verticalAlign={select(
      'verticalAlign',
      {
        start: 'start',
        center: 'center',
        end: 'end',
      },
      undefined,
    )}
    vertical={boolean('vertical', false)}
    verticalStretch={boolean('verticalStretch', false)}
    reverse={boolean('reverse', false)}
    wrap={boolean('wrap', false)}
    noWrap={boolean('noWrap', false)}
    flexiTruncate={boolean('flexiTruncate', false)}
  >
    <GridCol
      className="slds-box"
      noFlex={boolean('noFlex - col 1', false)}
      noSpace={boolean('noSpace - col 1', false)}
      grow={boolean('grow - col 1', false)}
      growNone={boolean('growNone - col 1', false)}
      shrink={boolean('shrink - col 1', false)}
      shrinkNone={boolean('shrinkNone - col 1', false)}
      bump={select(
        'bump - col 1',
        {
          top: 'top',
          right: 'right',
          bottom: 'bottom',
          left: 'left',
        },
        undefined,
      )}
      size={number('size', undefined)}
      maxSize={number('maxSize', undefined)}
    >
      no size set
    </GridCol>
    <GridCol
      className="slds-box"
      noFlex={boolean('noFlex - col 2', false)}
      noSpace={boolean('noSpace - col 2', false)}
      grow={boolean('grow - col 2', false)}
      growNone={boolean('growNone - col 2', false)}
      shrink={boolean('shrink - col 2', false)}
      shrinkNone={boolean('shrinkNone - col 2', false)}
      bump={select(
        'bump - col 2',
        {
          top: 'top',
          right: 'right',
          bottom: 'bottom',
          left: 'left',
        },
        undefined,
      )}
      size={number('size', undefined)}
      maxSize={number('maxSize', undefined)}
    >
      no size set
    </GridCol>
    <GridCol
      className="slds-box"
      noFlex={boolean('noFlex - col 3', false)}
      noSpace={boolean('noSpace - col 3', false)}
      grow={boolean('grow - col 3', false)}
      growNone={boolean('growNone - col 3', false)}
      shrink={boolean('shrink - col 3', false)}
      shrinkNone={boolean('shrinkNone - col 3', false)}
      bump={select(
        'bump - col 3',
        {
          top: 'top',
          right: 'right',
          bottom: 'bottom',
          left: 'left',
        },
        undefined,
      )}
      size={number('size - col 3', undefined)}
      maxSize={number('maxSize - col 3', undefined)}
    >
      no size set
    </GridCol>
  </Grid>
);

export const gridSizes = () => (
  <Grid
    gutters={boolean('gutters', false)}
    guttersDirect={boolean('guttersDirect', false)}
    guttersSize={select(
      'guttersSize',
      {
        'xxx-small': 'xxx-small',
        'xx-small': 'xx-small',
        'x-small': 'x-small',
        small: 'small',
        medium: 'medium',
        large: 'large',
        'x-large': 'x-large',
        'xx-large': 'xx-large',
      },
      undefined,
    )}
    pullPadded={boolean('pullPadded', false)}
    pullPaddedSize={select(
      'pullPaddedSize',
      {
        'xxx-small': 'xxx-small',
        'xx-small': 'xx-small',
        'x-small': 'x-small',
        small: 'small',
        medium: 'medium',
        large: 'large',
        'x-large': 'x-large',
        'xx-large': 'xx-large',
      },
      undefined,
    )}
    align={select(
      'align',
      {
        center: 'center',
        space: 'space',
        spread: 'spread',
        end: 'end',
      },
      undefined,
    )}
    verticalAlign={select(
      'verticalAlign',
      {
        start: 'start',
        center: 'center',
        end: 'end',
      },
      undefined,
    )}
    vertical={boolean('vertical', false)}
    verticalStretch={boolean('verticalStretch', false)}
    reverse={boolean('reverse', false)}
    wrap={boolean('wrap', true)}
    noWrap={boolean('noWrap', false)}
    flexiTruncate={boolean('flexiTruncate', false)}
  >
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>
    <GridCol className="slds-box" size={1}>
      size-1
    </GridCol>

    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>
    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>
    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>
    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>
    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>
    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>

    <GridCol className="slds-box" size={10}>
      size-10
    </GridCol>
    <GridCol className="slds-box" size={2}>
      size-2
    </GridCol>
  </Grid>
);
