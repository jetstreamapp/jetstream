import * as React from 'react';
function SvgYubiKey(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M38.5 14.1h-37c-.8 0-1.5.7-1.5 1.5v21c0 .8.7 1.5 1.5 1.5h37c.8 0 1.5-.7 1.5-1.5v-21c0-.8-.7-1.5-1.5-1.5zM21 32.2c-3.4 0-6.1-2.7-6.1-6.1S17.6 20 21 20s6.1 2.7 6.1 6.1-2.7 6.1-6.1 6.1z" />
        <circle cx={21} cy={26.1} r={1.2} />
        <path d="M50.5 18H36c-.8 0-1.5.7-1.5 1.5v13c0 .8.7 1.5 1.5 1.5h14.5c.8 0 1.5-.7 1.5-1.5v-13c0-.8-.7-1.5-1.5-1.5zm-3.4 4c.6 0 1 .4 1 1v1.9H40V22h7.1zm0 8H40v-2.7h8.1V29c0 .6-.4 1-1 1z" />
      </g>
    </svg>
  );
}
export default SvgYubiKey;
