import { css } from '@emotion/react';
import { Fragment, ReactNode } from 'react';
import Grid, { GridProps } from '../grid/Grid';

export function getModifierKey() {
  return typeof navigator === 'object' && /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'CTRL';
}

export interface KeyboardShortcutProps extends GridProps {
  keys: string[];
  preContent?: ReactNode;
  postContent?: ReactNode;
  separator?: ReactNode;
  inverse?: boolean;
}

export function KeyboardShortcut({ keys, preContent, postContent, separator = '+', inverse, ...rest }: KeyboardShortcutProps) {
  const bgColor = inverse ? `#e5e5e5` : `rgba(0, 0, 0, 0.06)`;
  const accentColor = inverse ? `#e5e5e5` : `#e5e5e5`;
  return (
    <Grid verticalAlign="center" {...rest}>
      {preContent && <span className="slds-m-right_x-small">{preContent}</span>}
      {keys.map((key, i) => (
        <Fragment key={key}>
          <kbd
            className={i === keys.length - 1 ? 'slds-m-right_x-small' : ''}
            css={css`
              align-items: center;
              background-color: ${bgColor};
              border-radius: 0.25rem;
              border: 1px solid ${accentColor};
              box-shadow: ${accentColor};
              box-shadow: inset 0 -1px 0 0 ${accentColor};
              color: rgba(24, 24, 27, 1);
              display: inline-flex;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, Noto Sans,
                sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol, Noto Color Emoji;
              font-size: 0.75rem;
              height: 1.25rem;
              justify-content: center;
              line-height: 1rem;
              min-width: 1.25rem;
              padding: 0.25rem;
              text-transform: capitalize;
              white-space: nowrap;
              text-transform: uppercase;
            `}
          >
            {key}
          </kbd>
          {i !== keys.length - 1 && <span className="slds-m-horizontal_xx-small">{separator}</span>}
        </Fragment>
      ))}
      {postContent}
    </Grid>
  );
}
