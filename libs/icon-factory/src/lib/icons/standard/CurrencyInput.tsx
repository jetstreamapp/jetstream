import * as React from 'react';
function SvgCurrencyInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M62.7 64.8c3.5-5.7 2.8-13.3-2.2-18.2a14.85 14.85 0 00-23.2 18.2zM80 26v48a6.02 6.02 0 01-6 6H26a6.02 6.02 0 01-6-6V26a6.02 6.02 0 016-6h48a6.02 6.02 0 016 6zM30 71.9h40a2 2 0 002-2V30a2 2 0 00-2-2H30a2 2 0 00-2 2v39.9c0 1.1.9 2 2 2z" />
    </svg>
  );
}
export default SvgCurrencyInput;
