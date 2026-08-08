import * as React from 'react';
function SvgBorderTop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <circle cx={55} cy={195} r={35} />
      <circle cx={465} cy={195} r={35} />
      <circle cx={465} cy={465} r={35} />
      <circle cx={55} cy={335} r={35} />
      <rect width={480} height={70} x={20} y={20} rx={10} />
      <circle cx={465} cy={335} r={35} />
      <circle cx={333} cy={465} r={35} />
      <circle cx={55} cy={465} r={35} />
      <circle cx={195} cy={465} r={35} />
    </svg>
  );
}
export default SvgBorderTop;
