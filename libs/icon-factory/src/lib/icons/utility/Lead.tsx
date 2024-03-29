import * as React from 'react';
function SvgLead(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <circle cx={26} cy={9.22} r={7.19} fill="unset" />
      <path
        d="M48.38 21.21H3.62c-1.6 0-2.24 2-.88 2.88l11.67 7.51c.56.4.88 1.12.64 1.76l-4.4 14.63c-.48 1.6 1.6 2.72 2.8 1.52L24.8 37.52c.64-.72 1.76-.72 2.4 0l11.35 11.99c1.12 1.2 3.2.08 2.8-1.52l-4.4-14.63c-.16-.64.08-1.36.64-1.76l11.67-7.51c1.36-.88.72-2.88-.88-2.88z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgLead;
