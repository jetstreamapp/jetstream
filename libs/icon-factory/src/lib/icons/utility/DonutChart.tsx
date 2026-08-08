import * as React from 'react';
function SvgDonutChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M20 221C36 119 119 36 221 20c10-2 18 6 18 16v91c0 7-5 14-12 15-41 11-74 43-85 85-2 7-8 12-15 12H36c-10 0-18-9-16-18m123 71c11 41 43 74 85 85 7 2 12 8 12 15v91c0 10-9 18-18 16A243 243 0 0121 298c-2-10 6-18 16-18h91c7 0 14 5 15 12m234 0c-11 42-44 74-85 85-7 2-12 8-12 15v92c0 10 9 18 18 16 102-16 184-98 201-201 2-10-6-18-16-18h-90c-7 0-14 4-16 11m-97-164V36c0-10 9-18 19-16 103 17 185 98 201 201 2 10-6 18-16 18h-92c-7 0-14-5-15-12-11-41-43-74-85-85-7-2-12-8-12-15z" />
    </svg>
  );
}
export default SvgDonutChart;
