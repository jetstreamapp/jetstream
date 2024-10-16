import * as React from 'react';
function SvgDefault(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path
        d="M446 328c21-21 49-34 81-34 42 0 79 23 99 57 17-7 36-12 56-12 76 1 138 62 138 137a137.4 137.4 0 01-165 134 101.3 101.3 0 01-132 41c-18 40-58 69-106 69-50 0-92-31-108-74-7 1-14 2-22 2a106.3 106.3 0 01-54-198c-7-15-10-31-10-48 0-67 56-122 124-122 41 0 77 19 99 48"
        opacity={0.5}
      />
    </svg>
  );
}
export default SvgDefault;
