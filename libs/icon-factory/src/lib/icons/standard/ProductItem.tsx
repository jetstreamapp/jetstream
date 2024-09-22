import * as React from 'react';
function SvgProductItem(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <rect height={160} rx={40} width={600} x={190} y={189} />
      <rect height={160} rx={40} width={270} x={190} y={409} />
      <rect height={160} rx={40} ry={49} width={270} x={190} y={629} />
      <rect height={160} rx={40} width={270} x={520} y={409} />
      <rect height={160} rx={40} width={270} x={520} y={629} />
    </svg>
  );
}
export default SvgProductItem;
