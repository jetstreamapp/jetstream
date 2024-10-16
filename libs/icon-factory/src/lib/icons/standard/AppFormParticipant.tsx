import * as React from 'react';
function SvgAppFormParticipant(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M22.86 46.01h20.82c1.43 0 2.6-1.17 2.6-2.6V42.2c0-3.17-3.69-5.07-7.15-6.55-.13-.09-.22-.13-.35-.17a.806.806 0 00-.82.04c-1.39.87-2.99 1.39-4.68 1.39s-3.3-.52-4.68-1.43a.806.806 0 00-.82-.04c-.13.09-.22.13-.35.17-3.47 1.52-7.15 3.43-7.15 6.59v1.21c0 1.43 1.17 2.6 2.6 2.6h-.01z"
        fill="unset"
      />
      <ellipse cx={33.26} cy={27.14} rx={6.46} ry={7.15} fill="unset" />
      <rect x={20.01} y={71.99} width={60} height={8} rx={2} ry={2} fill="unset" />
      <rect x={20.01} y={53.99} width={60} height={8} rx={2} ry={2} fill="unset" />
      <rect x={55.61} y={36} width={24.4} height={8} rx={2} ry={2} fill="unset" />
    </svg>
  );
}
export default SvgAppFormParticipant;
