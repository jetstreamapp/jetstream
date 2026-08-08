import * as React from 'react';
function SvgGuidanceCenter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M637 474a162 162 0 10162 162 162 162 0 00-162-162m0 280a119 119 0 11119-118 119 119 0 01-119 119zm63-188l-90 33a16 16 0 00-10 10l-32 89a6 6 0 007 7l89-32a16 16 0 0010-10l33-90a6 6 0 00-7-7m-63 92a22 22 0 1122-22 22 22 0 01-22 22M476 500H341a19 19 0 00-19 18v37a19 19 0 0019 18h95a209 209 0 0140-73" />
      <rect width={73} height={73} x={200} y={200} rx={18} />
      <rect width={420} height={73} x={322} y={200} rx={18} />
      <rect width={420} height={73} x={322} y={350} rx={18} />
      <rect width={73} height={73} x={200} y={350} rx={18} />
      <rect width={73} height={73} x={200} y={500} rx={18} />
    </svg>
  );
}
export default SvgGuidanceCenter;
