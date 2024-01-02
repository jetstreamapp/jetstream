import * as React from 'react';
function SvgCurrencyInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path fill="unset" d="M62.7 64.8c3.5-5.7 2.8-13.3-2.2-18.2-5.8-5.8-15.2-5.8-21 0-4.9 4.9-5.7 12.5-2.2 18.2h25.4z" />
      <path
        fill="unset"
        d="M80 26v48c0 3.3-2.7 6-6 6H26c-3.3 0-6-2.7-6-6V26c0-3.3 2.7-6 6-6h48c3.3 0 6 2.7 6 6zM30 71.9h40c1.1 0 2-.9 2-2V30c0-1.1-.9-2-2-2H30c-1.1 0-2 .9-2 2v39.9c0 1.1.9 2 2 2z"
      />
    </svg>
  );
}
export default SvgCurrencyInput;
