import * as React from 'react';
function SvgCurrencyInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M359 376a117 117 0 00-17-143 116 116 0 00-164 0 117 117 0 00-17 143h198zM495 72v376c0 26-21 47-47 47H72a47 47 0 01-47-47V72c0-26 21-47 47-47h376c26 0 47 21 47 47zM103 432h313c9 0 16-7 16-16V103c0-9-7-16-16-16H103c-9 0-16 7-16 16v313c1 9 8 16 16 16z" />
    </svg>
  );
}
export default SvgCurrencyInput;
