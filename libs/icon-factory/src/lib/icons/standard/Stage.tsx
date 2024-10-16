import * as React from 'react';
function SvgStage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M319 500c0 99 81 180 180 180s180-81 180-180-81-180-180-180-180 81-180 180zm300 0c0 66-54 120-120 120s-120-54-120-120 54-120 120-120 120 54 120 120z" />
      <circle cx={759} cy={500} r={42} />
      <circle cx={498} cy={500} r={42} />
      <circle cx={241} cy={500} r={42} />
    </svg>
  );
}
export default SvgStage;
