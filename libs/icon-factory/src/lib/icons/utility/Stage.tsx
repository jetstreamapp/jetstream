import * as React from 'react';
function SvgStage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M116 260c0 79 65 144 144 144a144 144 0 10-144-144zm239 0a96 96 0 11-192 0 96 96 0 01192 0z" />
      <circle cx={467} cy={260} r={34} />
      <circle cx={259} cy={260} r={34} />
      <circle cx={54} cy={260} r={34} />
    </svg>
  );
}
export default SvgStage;
