import * as React from 'react';
function SvgDisplayText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M72.3 20.1H27.8c-4.3 0-7.8 3.5-7.8 7.8v44.3c0 4.3 3.5 7.8 7.8 7.8h44.4c4.3 0 7.8-3.5 7.8-7.8V27.9c.1-4.3-3.4-7.8-7.7-7.8zm-41.9 13c0-1.4 1.2-2.6 2.6-2.6h29.2c1.4 0 2.6 1.2 2.6 2.6v2.7c0 1.4-1.1 2.6-2.5 2.6H33c-1.4 0-2.6-1.2-2.6-2.6v-2.7zm30.8 34c0 1.4-1.1 2.6-2.5 2.6H33c-1.4 0-2.6-1.2-2.6-2.6v-2.6c0-1.4 1.2-2.6 2.6-2.6h25.6c1.4 0 2.6 1.2 2.6 2.6v2.6zm8.4-15.7c0 1.4-1.1 2.6-2.5 2.6H33c-1.4 0-2.6-1.2-2.6-2.6v-2.6c0-1.4 1.2-2.6 2.6-2.6h34c1.4 0 2.6 1.2 2.6 2.6v2.6z"
      />
    </svg>
  );
}
export default SvgDisplayText;
