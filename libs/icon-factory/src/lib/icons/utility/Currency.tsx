import * as React from 'react';
function SvgCurrency(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M45.1 10.9H6.9c-2.4 0-4.4 2-4.4 4.4v21.3c0 2.4 2 4.4 4.4 4.4h38.2c2.4 0 4.4-2 4.4-4.4V15.4c0-2.5-2-4.5-4.4-4.5zM12 36.6c0-2.9-2.3-5.1-5.1-5.1v-11c2.9 0 5.1-2.3 5.1-5.1h28c0 2.9 2.3 5.1 5.1 5.1v11c-2.9 0-5.1 2.3-5.1 5.1H12z" />
        <circle cx={26} cy={25.6} r={7.3} />
      </g>
    </svg>
  );
}
export default SvgCurrency;
