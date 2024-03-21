import * as React from 'react';
function SvgDialIn(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <circle cx={10} cy={10} r={6} />
        <circle cx={10} cy={26} r={6} />
        <circle cx={26} cy={10} r={6} />
        <circle cx={42} cy={10} r={6} />
        <circle cx={26} cy={26} r={6} />
        <circle cx={42} cy={26} r={6} />
        <circle cx={10} cy={42} r={6} />
        <circle cx={26} cy={42} r={6} />
        <circle cx={42} cy={42} r={6} />
      </g>
    </svg>
  );
}
export default SvgDialIn;
