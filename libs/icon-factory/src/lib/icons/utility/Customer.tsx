import * as React from 'react';
function SvgCustomer(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M303 388h119c3 1 7-2 7-6l21-76c2-4-1-8-5-9l-2-1H260l-3-11c-1-5-6-9-11-9h-20c-6 0-12 5-12 11-1 7 4 12 10 13h13l10 35 27 92c2 5 6 8 12 9h139c6 0 12-5 12-11 1-7-3-12-10-13H303c-5 0-10-3-12-8v-1a12 12 0 0112-15zm-89-42l-4-13c-7-3-14-7-19-13a47 47 0 0136-79h19c16 0 30 7 39 20h51c-15-10-31-19-48-25-29-12-32-24-32-35 1-12 7-24 17-32 17-16 26-39 25-62 0-47-28-87-78-87s-79 40-79 87c0 23 9 45 26 62 10 8 16 20 17 32 0 12-4 23-32 35-43 17-82 38-83 76-1 25 17 46 42 47h105z" />
      <circle cx={306} cy={480} r={20} />
      <circle cx={402} cy={480} r={20} />
    </svg>
  );
}
export default SvgCustomer;
