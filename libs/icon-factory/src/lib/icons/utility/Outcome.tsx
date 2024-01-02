import * as React from 'react';
function SvgOutcome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M36.2 11.6l-.1-.1c-.6-.5-1.5-.5-2 .1l-2.2 2.1c-.6.6-.5 1.5 0 2l5.6 5.6c.2.2.3.4.3.7 0 .6-.4 1.1-1 1.1H15.6c-.8 0-1.5.6-1.5 1.4v3c.1.8.7 1.5 1.5 1.6h21.3c.2 0 .4.1.5.2.5.4.5 1 .2 1.5L32 36.5c-.6.6-.5 1.5 0 2l2.1 2.2c.6.6 1.5.5 2 0l13.5-13.5c.6-.6.5-1.5 0-2L36.2 11.6z"
      />
      <path
        fill="unset"
        d="M21.1 17.2h3c.8 0 1.5-.7 1.5-1.5V6.1c0-2.2-1.8-4-4-4H6.1c-2.2 0-4 1.8-4 4v40c0 2.2 1.8 4 4 4h15.4c2.2 0 4-1.8 4-4v-9.5c0-.8-.7-1.5-1.5-1.5h-3c-.8 0-1.5.7-1.5 1.5v5.9c0 .8-.7 1.5-1.5 1.5H9.6c-.8 0-1.5-.7-1.5-1.5v-33c0-.8.7-1.5 1.5-1.5H18c.8 0 1.5.7 1.5 1.5v6.1c.1.9.7 1.6 1.6 1.6z"
      />
    </svg>
  );
}
export default SvgOutcome;
