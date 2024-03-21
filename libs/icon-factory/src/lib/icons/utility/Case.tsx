import * as React from 'react';
function SvgCase(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M17.2 11.3h2.9c.4 0 .7-.3.7-.7V8.4h10.3v2.2c0 .4.3.7.7.7h2.9c.4 0 .7-.3.7-.7V8.4C35.4 6 33.4 4 31 4H20.9c-2.4 0-4.4 2-4.4 4.4v2.2c0 .4.2.7.7.7zm26.4 4.4H8.4c-2.4 0-4.4 2-4.4 4.4v23.5C4 46 6 48 8.4 48h35.2c2.4 0 4.4-2 4.4-4.4V20.1c0-2.4-2-4.4-4.4-4.4z"
      />
    </svg>
  );
}
export default SvgCase;
