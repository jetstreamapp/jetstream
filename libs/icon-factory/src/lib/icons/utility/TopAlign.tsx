import * as React from 'react';
function SvgTopAlign(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <rect width={480} height={64} x={20} y={20} rx={16} />
      <rect width={144} height={376} x={188} y={124} rx={32} />
    </svg>
  );
}
export default SvgTopAlign;
