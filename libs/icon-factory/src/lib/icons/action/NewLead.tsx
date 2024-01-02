import * as React from 'react';
function SvgNewLead(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <circle fill="unset" cx={26} cy={9.2} r={7.2} />
      <path
        fill="unset"
        d="M48.4 21.2H3.6c-1.6 0-2.2 2-.9 2.9l11.7 7.5c.6.4.9 1.1.6 1.8L10.7 48c-.5 1.6 1.6 2.7 2.8 1.5l11.4-12c.6-.7 1.8-.7 2.4 0l11.4 12c1.1 1.2 3.2.1 2.8-1.5L37 33.3c-.2-.6.1-1.4.6-1.8L49.3 24c1.3-.8.7-2.8-.9-2.8z"
      />
    </svg>
  );
}
export default SvgNewLead;
