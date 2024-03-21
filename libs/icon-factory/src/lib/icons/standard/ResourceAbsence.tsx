import * as React from 'react';
function SvgResourceAbsence(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M49.91 20a25.4 25.4 0 1025.18 25.5c0-13.79-11.24-25.5-25.18-25.5zm16.61 38l-4.73 4.73-12.25-12.27L37.9 62.1l-4.74-4.74L44.8 45.73 33.1 34l4.73-4.73L49.53 41l12.31-12.32 4.74 4.74-12.31 12.31z"
        fill="unset"
        fillRule="evenodd"
      />
      <path
        d="M26 64.21h-1.27A4.75 4.75 0 0020 68.95v6.31A4.74 4.74 0 0024.73 80h50.54A4.75 4.75 0 0080 75.26v-6.31a4.74 4.74 0 00-4.73-4.74h-1.54a30.15 30.15 0 01-47.72 0z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgResourceAbsence;
