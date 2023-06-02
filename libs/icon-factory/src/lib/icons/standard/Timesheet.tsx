import * as React from 'react';
function SvgTimesheet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M70.9 20H29.1c-4.3 0-7.8 3.5-7.8 7.8v44.3c0 4.3 3.5 7.8 7.8 7.8h41.7c4.3 0 7.8-3.5 7.8-7.8V27.8c.1-4.3-3.4-7.8-7.7-7.8zm-2.6 47c0 1.4-1.2 2.6-2.6 2.6H34.3c-1.4 0-2.6-1.2-2.6-2.6v-2.6c0-1.4 1.2-2.6 2.6-2.6h31.3c1.4 0 2.6 1.2 2.6 2.6V67zm0-15.7c0 1.4-1.2 2.6-2.6 2.6H34.3c-1.4 0-2.6-1.2-2.6-2.6v-2.6c0-1.4 1.2-2.6 2.6-2.6h31.3c1.4 0 2.6 1.2 2.6 2.6v2.6zm0-15.6c0 1.4-1.2 2.6-2.6 2.6H34.3c-1.4 0-2.6-1.2-2.6-2.6V33c0-1.4 1.2-2.6 2.6-2.6h31.3c1.4 0 2.6 1.2 2.6 2.6v2.7z"
      />
    </svg>
  );
}
export default SvgTimesheet;
