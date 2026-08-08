import * as React from 'react';
function SvgAppFormParticipant(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <g transform="scale(10)">
        <path d="M22.9 46h20.8c1.4 0 2.6-1.2 2.6-2.6v-1.2c0-3.2-3.7-5-7.2-6.5l-.3-.2a.8.8 0 00-.8 0 8.5 8.5 0 01-9.4 0 .8.8 0 00-.8 0l-.4.1c-3.4 1.5-7.1 3.4-7.1 6.6v1.2c0 1.4 1.2 2.6 2.6 2.6" />
        <ellipse cx={33.3} cy={27.1} rx={6.5} ry={7.2} />
        <rect width={60} height={8} x={20} y={72} rx={2} />
        <rect width={60} height={8} x={20} y={54} rx={2} />
        <rect width={24.4} height={8} x={55.6} y={36} rx={2} />
      </g>
    </svg>
  );
}
export default SvgAppFormParticipant;
