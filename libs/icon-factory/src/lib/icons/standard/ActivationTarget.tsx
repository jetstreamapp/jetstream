import * as React from 'react';
function SvgActivationTarget(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M750 204H578a50 50 0 00-50 50v170a50 50 0 0050 50h172a50 50 0 0050-50V254a50 50 0 00-50-50zm-10 60v150H588V264zM280 510a16 16 0 00-16 17v35a16 16 0 0016 16h62a11 11 0 018 4 12 12 0 011 17L205 743a17 17 0 00-1 24l25 25a21 21 0 0026 0l146-145a9 9 0 016-3 13 13 0 0114 11l1 52a16 16 0 0016 17h36a17 17 0 0016-16V528a17 17 0 00-17-16z" />
    </svg>
  );
}
export default SvgActivationTarget;
