import * as React from 'react';
function SvgNumberInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M448 495H72a47 47 0 01-47-47V72c0-26 21-47 47-47h376c26 0 47 21 47 47v376c0 26-21 47-47 47zM88 103v313c0 9 7 16 16 16h313c9 0 16-7 16-16V103c0-9-7-16-16-16H104c-9 1-16 8-16 16zm274 100h-29l12-48v-1c0-2-1-4-4-4h-23c-2 0-3 1-4 3l-12 49h-58l12-48v-1c0-2-1-4-4-4h-23c-2 0-3 1-4 3l-13 49h-32c-2 0-3 1-4 3l-6 22v1c0 2 1 4 4 4h30l-14 56h-31c-2 0-3 1-4 3l-6 22v1c0 2 1 4 4 4h29l-12 48v1c0 2 1 4 4 4h23c2 0 3-1 4-3l13-50h57l-11 47v1c0 2 1 4 4 4h23c2 0 3-1 4-3l13-50h32c2 0 3-1 4-3l6-22v-1c0-2-1-4-4-4h-30l14-56h31c2 0 3-1 4-3l6-22v-1c-1 1-3-1-5-1zm-81 85h-58l14-56h57l-13 56z" />
    </svg>
  );
}
export default SvgNumberInput;
