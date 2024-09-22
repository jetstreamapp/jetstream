import * as React from 'react';
function SvgCardDetails(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M45.2 8.6H6.8C4.16 8.6 2 10.76 2 13.4v27.2c0 2.64 2.16 4.8 4.8 4.8h38.4c2.64 0 4.8-2.16 4.8-4.8V13.4c0-2.64-2.16-4.8-4.8-4.8zm0 4.8v4.8H6.8v-4.8h38.4zM6.8 40.6V26.2h38.4v14.4H6.8z"
        fill="unset"
      />
      <path
        d="M20.48 30.2c-1.12 0-2.08.56-2.64 1.44-.08.16-.32.16-.4 0a3.09 3.09 0 00-2.64-1.44 3.21 3.21 0 00-3.2 3.2c0 1.76 1.44 3.2 3.2 3.2 1.12 0 2.08-.56 2.64-1.44.08-.16.32-.16.4 0a3.09 3.09 0 002.64 1.44h.08c1.68 0 3.12-1.36 3.12-3.12v-.16c-.08-1.76-1.44-3.12-3.2-3.12zM38.8 31h-9.6c-.88 0-1.6.72-1.6 1.6v1.6c0 .88.72 1.6 1.6 1.6h9.6c.88 0 1.6-.72 1.6-1.6v-1.6c0-.88-.72-1.6-1.6-1.6z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgCardDetails;
