import * as React from 'react';
function SvgLoop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M472 326l-1 2c-3 9-5 18-9 26-4 9-8 19-13 27a240 240 0 01-139 109A226 226 0 0120 271 230 230 0 01366 74a225 225 0 0155 45c8 6 13 2 13-8V36c0-8 8-16 16-16h32c9 0 16 8 17 16v196c0 8-6 14-14 14H289c-9 0-15-6-15-15v-33c0-9 8-16 16-16h75c6 0 12-2 14-5a160 160 0 1021 148s3-14 14-14h46c7 0 13 5 13 12l-1 3z" />
    </svg>
  );
}
export default SvgLoop;
