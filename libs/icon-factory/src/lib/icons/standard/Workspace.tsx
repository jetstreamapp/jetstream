import * as React from 'react';
function SvgWorkspace(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <rect x={20.14} y={26.66} width={20} height={20} rx={4} ry={4} fill="unset" />
      <rect x={60.14} y={54.66} width={20} height={20} rx={4} ry={4} fill="unset" />
      <rect x={20.14} y={54.66} width={31} height={26} rx={4} ry={4} fill="unset" />
      <rect x={49.14} y={20.66} width={31} height={26} rx={4} ry={4} fill="unset" />
    </svg>
  );
}
export default SvgWorkspace;
