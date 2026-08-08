import * as React from 'react';
function SvgProductItem(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <rect width={600} height={160} x={190} y={189} rx={40} />
      <rect width={270} height={160} x={190} y={409} rx={40} />
      <rect width={270} height={160} x={190} y={629} rx={40} ry={49} />
      <rect width={270} height={160} x={520} y={409} rx={40} />
      <rect width={270} height={160} x={520} y={629} rx={40} />
    </svg>
  );
}
export default SvgProductItem;
