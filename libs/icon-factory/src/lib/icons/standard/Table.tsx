import * as React from 'react';
function SvgTable(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <rect width={150} height={75} x={225} y={350} rx={18} />
      <rect width={150} height={75} x={424} y={725} rx={18} />
      <rect width={150} height={75} x={225} y={476} rx={18} />
      <rect width={150} height={75} x={225} y={725} rx={18} />
      <rect width={549} height={99} x={225} y={200} rx={18} />
      <rect width={150} height={75} x={225} y={599} rx={18} />
      <rect width={150} height={75} x={424} y={599} rx={18} />
      <rect width={150} height={75} x={424} y={476} rx={18} />
      <rect width={150} height={75} x={625} y={476} rx={18} />
      <rect width={150} height={75} x={625} y={350} rx={18} />
      <rect width={150} height={75} x={625} y={599} rx={18} />
      <rect width={150} height={75} x={625} y={725} rx={18} />
      <rect width={150} height={75} x={424} y={350} rx={18} />
    </svg>
  );
}
export default SvgTable;
