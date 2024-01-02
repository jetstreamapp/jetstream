import * as React from 'react';
function SvgCurrencyInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path fill="unset" d="M35.9 37.6c2.7-4.5 2.2-10.4-1.7-14.3-4.5-4.5-11.9-4.5-16.4 0-3.9 3.9-4.4 9.8-1.7 14.3h19.8z" />
      <path
        fill="unset"
        d="M49.5 7.2v37.6c0 2.6-2.1 4.7-4.7 4.7H7.2c-2.6 0-4.7-2.1-4.7-4.7V7.2c0-2.6 2.1-4.7 4.7-4.7h37.6c2.6 0 4.7 2.1 4.7 4.7zm-39.2 36h31.3c.9 0 1.6-.7 1.6-1.6V10.3c0-.9-.7-1.6-1.6-1.6H10.3c-.9 0-1.6.7-1.6 1.6v31.3c.1.9.8 1.6 1.6 1.6z"
      />
    </svg>
  );
}
export default SvgCurrencyInput;
