import * as React from 'react';
function SvgProductItem(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <rect x={19} y={18.92} width={60} height={16} rx={4} ry={4} fill="unset" />
      <rect x={19} y={40.92} width={27} height={16} rx={4} ry={4} fill="unset" />
      <rect x={19} y={62.92} width={27} height={16} rx={4} ry={4} fill="unset" />
      <rect x={52} y={40.92} width={27} height={16} rx={4} ry={4} fill="unset" />
      <rect x={52} y={62.92} width={27} height={16} rx={4} ry={4} fill="unset" />
    </svg>
  );
}
export default SvgProductItem;
