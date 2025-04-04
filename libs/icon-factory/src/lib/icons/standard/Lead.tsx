import * as React from 'react';
function SvgLead(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M780 440H220c-20 0-28 25-11 36l146 94c7 5 11 14 8 22l-55 183c-6 20 20 34 35 19l142-150c8-9 22-9 30 0l142 150c14 15 40 1 35-19l-55-183c-2-8 1-17 8-22l146-94c17-11 9-36-11-36z" />
      <circle cx={500} cy={290} r={90} />
    </svg>
  );
}
export default SvgLead;
