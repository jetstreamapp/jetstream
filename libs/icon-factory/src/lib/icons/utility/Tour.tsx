import * as React from 'react';
function SvgTour(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M499 371a90 90 0 01-90 90H143a75 75 0 002-15 74 74 0 00-2-15h266a60 60 0 000-120H110a90 90 0 010-180h203a148 148 0 0010 30H110a60 60 0 000 120h299a89 89 0 0136 7 87 87 0 0132 24 90 90 0 0122 59zM425 29a75 75 0 00-76 76c0 52 54 100 71 113a8 8 0 0010 0c16-13 70-61 70-113a75 75 0 00-75-76zm0 107a32 32 0 1131-31 32 32 0 01-31 31z" />
      <circle cx={65} cy={446} r={45} />
    </svg>
  );
}
export default SvgTour;
