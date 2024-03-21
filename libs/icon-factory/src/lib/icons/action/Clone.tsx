import * as React from 'react';
function SvgClone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M46 2H18c-2.2 0-4 1.8-4 4v2.5c0 .8.7 1.5 1.5 1.5H34c4.4 0 8 3.6 8 8v18.5c0 .8.7 1.5 1.5 1.5H46c2.2 0 4-1.8 4-4V6c0-2.2-1.8-4-4-4z" />
        <path d="M34 14H6c-2.2 0-4 1.8-4 4v28c0 2.2 1.8 4 4 4h28c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4zm-4 27c0 .6-.4 1-1 1H11c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h18c.6 0 1 .4 1 1v2zm0-8c0 .6-.4 1-1 1H11c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h18c.6 0 1 .4 1 1v2zm0-8c0 .6-.4 1-1 1H11c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h18c.6 0 1 .4 1 1v2z" />
      </g>
    </svg>
  );
}
export default SvgClone;
