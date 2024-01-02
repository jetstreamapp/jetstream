import * as React from 'react';
function SvgUnmuted(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M41.5 18c-1.4 0-2.5 1-2.5 2.4v4c0 7-5.9 12.8-13.1 12.8s-13.1-5.8-13.1-12.8v-4c0-1.4-1.1-2.4-2.5-2.4S8 19 8 20.4v4c0 8.9 6.8 16.2 15.5 17.4v3.4h-4.1c-1.4 0-2.5 1-2.5 2.4S18 50 19.4 50h13.1c1.4 0 2.5-1 2.5-2.4s-1.1-2.4-2.5-2.4h-4.1v-3.4C37.2 40.6 44 33.3 44 24.4v-4c0-1.4-1.1-2.4-2.5-2.4z" />
        <path d="M26 32.4c4.4 0 8-3.6 8-8V9.9C34 5.5 30.5 2 26.1 2h-.2C21.5 2 18 5.5 18 9.9v14.5c0 4.4 3.6 8 8 8z" />
      </g>
    </svg>
  );
}
export default SvgUnmuted;
