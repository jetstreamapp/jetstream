import * as React from 'react';
function SvgForm(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <rect fill="none" height={6} rx={2} width={34} x={33} y={50} />
      <rect fill="none" height={6} rx={2} width={30} x={33} y={62} />
      <g fill="unset">
        <path d="M63 36h10.6a1.37 1.37 0 001.4-1.4 1.28 1.28 0 00-.4-1L61.4 20.4a1.28 1.28 0 00-1-.4 1.37 1.37 0 00-1.4 1.4V32a4 4 0 004 4z" />
        <path d="M73 42H59a6 6 0 01-6-6V22a2 2 0 00-2-2H31a6 6 0 00-6 6v48a6 6 0 006 6h38a6 6 0 006-6V44a2 2 0 00-2-2zm-40-2a2 2 0 012-2h8.18a2 2 0 012 2v2a2 2 0 01-2 2H35a1.94 1.94 0 01-2-2zm30 26a2 2 0 01-2 2H35a2 2 0 01-2-2v-2a2 2 0 012-2h26a2 2 0 012 2zm4-12a2 2 0 01-2 2H35a2 2 0 01-2-2v-2a2 2 0 012-2h30a2 2 0 012 2z" />
      </g>
    </svg>
  );
}
export default SvgForm;
