import { css } from '@emotion/react';

const DEFAULT_TAIL_LENGTH = 14;

interface MiddleTruncatedTextProps {
  text: string;
  /** Number of trailing characters that are always shown, the start of the text shrinks with an ellipsis instead */
  tailLength?: number;
  className?: string;
}

/**
 * Truncates the middle of text using CSS only, so it adapts to the container width, font size and OS text scaling.
 * The start shrinks with an ellipsis while the tail never does, which keeps the distinguishing suffix visible.
 */
export function MiddleTruncatedText({ text, tailLength = DEFAULT_TAIL_LENGTH, className }: MiddleTruncatedTextProps) {
  const splitIndex = Math.max(0, text.length - tailLength);
  const start = text.slice(0, splitIndex);
  const tail = text.slice(splitIndex);

  return (
    <span
      title={text}
      className={className}
      css={css`
        display: flex;
        min-width: 0;
        white-space: nowrap;
      `}
    >
      {start && (
        <span
          css={css`
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
          `}
        >
          {start}
        </span>
      )}
      <span
        css={css`
          flex-shrink: 0;
        `}
      >
        {tail}
      </span>
    </span>
  );
}
