import * as React from 'react';
function SvgRightAlign(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <rect width={64} height={480} x={436} y={20} rx={16} />
      <rect width={376} height={144} x={20} y={188} rx={32} />
    </svg>
  );
}
export default SvgRightAlign;
