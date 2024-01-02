import * as React from 'react';
function SvgCurrency(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M74.4 30.8H25.6c-3.1 0-5.6 2.5-5.6 5.6v27.2c0 3.1 2.5 5.6 5.6 5.6h48.8c3.1 0 5.6-2.5 5.6-5.6V36.4c0-3.1-2.5-5.6-5.6-5.6zM32.2 63.6c0-3.7-2.9-6.6-6.6-6.6V43c3.7 0 6.6-2.9 6.6-6.6h35.6c0 3.7 2.9 6.6 6.6 6.6v14c-3.7 0-6.6 2.9-6.6 6.6H32.2z" />
        <circle cx={50} cy={49.5} r={9.4} />
      </g>
    </svg>
  );
}
export default SvgCurrency;
