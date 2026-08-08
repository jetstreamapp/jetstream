import * as React from 'react';
function SvgWorkspace(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <rect width={200} height={200} x={201} y={267} rx={40} />
      <rect width={200} height={200} x={601} y={547} rx={40} />
      <rect width={310} height={260} x={201} y={547} rx={40} />
      <rect width={310} height={260} x={491} y={207} rx={40} />
    </svg>
  );
}
export default SvgWorkspace;
