import * as React from 'react';
function SvgLabels(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M41.92 26.35L32.58 17c-.63-.7-1.51-1.11-2.45-1.13l-24.25-.19a3.91 3.91 0 00-3.81 3.78L2 38.42a3.909 3.909 0 003.78 3.8l23.92.15c.88.06 1.73-.26 2.35-.89l9.79-9.72a4 4 0 00.08-5.41z"
        fill="unset"
        fillRule="evenodd"
      />
      <path
        d="M46 28.82a3.996 3.996 0 00.08-5.48l-9.34-9.53a3.297 3.297 0 00-2.45-1.13L10 12.53c-.27 0-.54.04-.81.1a4 4 0 013.71-3l24.26.16c.94.01 1.82.43 2.44 1.13l9.4 9.53a3.996 3.996 0 01-.08 5.48"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgLabels;
