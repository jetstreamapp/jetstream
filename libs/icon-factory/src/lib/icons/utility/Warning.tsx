import * as React from 'react';
function SvgWarning(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M514 425L285 55a28 28 0 00-50 0L6 425c-14 23 0 55 25 55h458c25 0 40-32 25-55zm-254-25c-17 0-30-13-30-30s13-30 30-30 30 13 30 30-13 30-30 30zm30-90c0 6-4 10-10 10h-40c-6 0-10-4-10-10V180c0-6 4-10 10-10h40c6 0 10 4 10 10v130z" />
    </svg>
  );
}
export default SvgWarning;
