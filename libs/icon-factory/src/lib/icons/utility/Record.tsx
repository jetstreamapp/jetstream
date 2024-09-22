import * as React from 'react';
function SvgRecord(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 80a180 180 0 110 360 180 180 0 010-360z" />
    </svg>
  );
}
export default SvgRecord;
