import * as React from 'react';
function SvgQuote(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M35 23H17c-.6 0-1 .4-1 1v3c0 .6.4 1 1 1h18c.6 0 1-.4 1-1v-3c0-.6-.4-1-1-1zM33 32H19c-.6 0-1 .4-1 1v3c0 .6.4 1 1 1h14c.6 0 1-.4 1-1v-3c0-.6-.4-1-1-1z" />
        <path d="M45.8 12.3l-9.6-9.2c-.8-.7-1.8-1.1-2.8-1.1H18.6c-1 0-2 .4-2.8 1.1l-9.6 9.2c-.8.8-1.2 1.8-1.2 2.9V46c0 2.2 1.8 4 4 4h34c2.2 0 4-1.8 4-4V15.2c0-1.1-.4-2.1-1.2-2.9zM26 5c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4zm15 37.5c0 .8-.7 1.5-1.5 1.5h-27c-.8 0-1.5-.7-1.5-1.5v-25c0-.8.7-1.5 1.5-1.5h27c.8 0 1.5.7 1.5 1.5v25z" />
      </g>
    </svg>
  );
}
export default SvgQuote;
