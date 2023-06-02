import * as React from 'react';
function SvgChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M45.5 23.4L25 34.7c-1.4.7-3-.3-3-1.8V8.4c0-1-1-1.8-1.9-1.5-10 2.8-17.2 12.5-16 23.6 1.1 10.1 9.2 18.3 19.4 19.4C36.8 51.3 48 41 48 28c0-1.2-.1-2.4-.3-3.6-.2-1-1.3-1.5-2.2-1z" />
        <path d="M27.7 28l19.7-10.5c1.2-.6 1.6-2.2.8-3.3C43.7 8 36.7 3.5 28.7 2.2 27.3 1.9 26 3 26 4.4V27c0 .9.9 1.4 1.7 1z" />
      </g>
    </svg>
  );
}
export default SvgChart;
