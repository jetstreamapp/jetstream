import * as React from 'react';
function SvgOrgChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M467 192H360a12 12 0 00-12 12v37h-74l-1-147a15 15 0 00-15-14H157V40a12 12 0 00-12-12H37a12 12 0 00-12 12v108a12 12 0 0012 12h108a12 12 0 0012-12v-38h86l1 146a15 15 0 0015 15h89v40a12 12 0 0012 12h107a12 12 0 0012-12V204a12 12 0 00-12-12z" />
      <rect width={132} height={132} x={348} y={28} rx={12} />
      <rect width={132} height={132} x={348} y={355} rx={12} />
    </svg>
  );
}
export default SvgOrgChart;
