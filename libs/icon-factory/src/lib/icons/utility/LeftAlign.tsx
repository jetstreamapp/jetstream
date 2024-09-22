import * as React from 'react';
function SvgLeftAlign(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <rect width={64} height={480} x={20} y={20} rx={16} />
      <rect width={384} height={142} x={116} y={188} rx={32} />
    </svg>
  );
}
export default SvgLeftAlign;
