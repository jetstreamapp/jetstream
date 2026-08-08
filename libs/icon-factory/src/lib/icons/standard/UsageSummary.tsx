import * as React from 'react';
function SvgUsageSummary(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <g transform="scale(10)">
        <path
          fillRule="evenodd"
          d="M21.5 50.7h45.3c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5H27.6c-.8 0-1.5-.7-1.5-1.5v-7.1c0-.8-.7-1.5-1.5-1.5h-3c-.8 0-1.5.7-1.5 1.5v13.1c0 .8.7 1.5 1.5 1.5z"
        />
        <rect width={10.1} height={6} x={44.2} y={34.6} rx={1.5} />
        <rect width={10.1} height={6} x={30.1} y={34.6} rx={1.5} />
        <rect width={10.1} height={6} x={58.3} y={34.6} rx={1.5} />
        <rect width={10.1} height={6} x={44.2} y={54.8} rx={1.5} />
        <path
          fillRule="evenodd"
          d="M26 63.3v-7.1c0-.8-.7-1.5-1.5-1.5h-3c-.8 0-1.5.7-1.5 1.5v13.1c0 .8.7 1.5 1.5 1.5h28.9c0-2.1.7-4.2 1.8-6H27.5c-.8 0-1.5-.7-1.5-1.5"
        />
        <rect width={48.4} height={8.1} x={20} y={22.5} rx={1.5} />
        <path fillRule="evenodd" d="M66.8 54.8h-7.1c-.8 0-1.5.7-1.5 1.5v2.2c2.4-1.5 5.1-2.4 7.9-2.4s1.5 0 2.2.2c0-.8-.7-1.5-1.5-1.5" />
        <rect width={10.1} height={6} x={30.1} y={54.8} rx={1.5} />
        <path
          fillRule="evenodd"
          d="M80 67.5l-.6-.9-1.8.8a13.8 13.8 0 00-11.3-6.6c-6.7 0-13.1 6.2-13.1 12.8v.9h3.3v-.9c0-5.3 4.4-9.6 9.9-9.6a10 10 0 018.5 4.7l-6.3 2.7a3.6 3.6 0 00-4-.4c-.8.4-1.5 1.2-1.8 2.1s-.2 1.9.3 2.7c1 1.7 3.1 2.4 4.9 1.5 1.3-.6 2.1-2 1.9-3.5l5.8-3.5c.4 1.1.6 2.2.6 3.4v.9h3.2v-.9c0-1.7-.4-3.4-1.2-4.9l1.8-1.1z"
        />
      </g>
    </svg>
  );
}
export default SvgUsageSummary;
