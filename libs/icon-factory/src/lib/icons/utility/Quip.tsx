import * as React from 'react';
function SvgQuip(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M24.5 2.1c-12 .7-21.7 10.4-22.4 22.4C1.1 38.3 12.2 50 26 50h24V26C50 12.2 38.3 1.1 24.5 2.1zm-9.9 13.4c0-.9.7-1.6 1.6-1.6h19.6c.9 0 1.6.7 1.6 1.6v1.6c0 .9-.7 1.6-1.6 1.6H16.1c-.9 0-1.6-.7-1.6-1.6.1.1.1-1.6.1-1.6zm22.8 20.8c0 .9-.7 1.6-1.6 1.6H16.1c-.9 0-1.6-.7-1.6-1.6v-1.6c0-.9.7-1.6 1.6-1.6h19.6c.9 0 1.6.7 1.6 1.6v1.6h.1zm6-9.5c0 .9-.7 1.6-1.6 1.6H10.1c-.9 0-1.6-.7-1.6-1.6v-1.6c0-.9.7-1.6 1.6-1.6h31.7c.9 0 1.6.7 1.6 1.6v1.6z"
      />
    </svg>
  );
}
export default SvgQuip;
