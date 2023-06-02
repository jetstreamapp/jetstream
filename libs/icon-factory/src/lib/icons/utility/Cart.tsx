import * as React from 'react';
function SvgCart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M20.1 26H44c.7 0 1.4-.5 1.5-1.2l4.4-15.4c.3-1.1-.5-2-1.5-2H11.5l-.6-2.3C10.6 4 9.6 3.3 8.6 3.3h-4c-1.3 0-2.5 1-2.6 2.3C1.9 7 3.1 8.2 4.4 8.2h2.3l7.6 25.7c.3 1.1 1.2 1.8 2.3 1.8h28.2c1.3 0 2.5-1 2.6-2.3.1-1.4-1.1-2.6-2.4-2.6H20.2c-1.1 0-2-.7-2.3-1.7V29c-.5-1.5.7-3 2.2-3z" />
        <circle cx={20.6} cy={44.6} r={4} />
        <circle cx={40.1} cy={44.6} r={4} />
      </g>
    </svg>
  );
}
export default SvgCart;
