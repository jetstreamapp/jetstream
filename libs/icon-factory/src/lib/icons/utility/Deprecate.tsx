import * as React from 'react';
function SvgDeprecate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M48 7H4c-1.1 0-2 .9-2 2v26c0 1.1.9 2 2 2h16.2c1 5.7 5.9 10 11.8 10s10.9-4.3 11.8-10H48c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-8.6 32.6l-2.8 2.8-4.6-4.6-4.6 4.6-2.8-2.8 4.6-4.6-4.6-4.6 2.8-2.8 4.6 4.6 4.6-4.6 2.8 2.8-4.6 4.6 4.6 4.6zM46 33h-2.2c-1-5.7-5.9-10-11.8-10s-10.9 4.3-11.8 10H6V11h40v22z"
      />
    </svg>
  );
}
export default SvgDeprecate;
