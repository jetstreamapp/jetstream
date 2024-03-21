import * as React from 'react';
function SvgSteps(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M73 80.3h-8.8v-6H73v6zm0-2.9v-.1.1zm-17.6 2.9h-8.8v-6h8.8v6zm-17.5 0h-8.8v-6h8.8v6zm-11.8-7.4h-6v-8.8h6v8.8zm53.8-2.1h-6V62h6v8.8zM26.1 55.4h-6v-8.8h6v8.8zm53.8-2.1h-6v-8.8h6v8.8zM26.1 37.9h-6v-8.8h6v8.8zm53.8-2.1h-6V27h6v8.8zm-9.1-10.1H62v-6h8.8v6zm-17.5 0h-8.8v-6h8.8v6zm-17.5 0h-8.7v-6h8.8v6z"
      />
    </svg>
  );
}
export default SvgSteps;
