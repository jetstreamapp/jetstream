import * as React from 'react';
function SvgBorderTop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <circle cx={5.5} cy={19.5} r={3.5} fill="unset" />
      <circle cx={46.5} cy={19.5} r={3.5} fill="unset" />
      <circle cx={46.5} cy={46.5} r={3.5} fill="unset" />
      <circle cx={5.5} cy={33.5} r={3.5} fill="unset" />
      <rect x={2} y={2} width={48} height={7} rx={1} ry={1} fill="unset" />
      <circle cx={46.5} cy={33.5} r={3.5} fill="unset" />
      <circle cx={33.3} cy={46.5} r={3.5} fill="unset" />
      <circle cx={5.5} cy={46.5} r={3.5} fill="unset" />
      <circle cx={19.5} cy={46.5} r={3.5} fill="unset" />
    </svg>
  );
}
export default SvgBorderTop;
