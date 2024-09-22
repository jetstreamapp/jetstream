import * as React from 'react';
function SvgSection(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M31 34h38a1 1 0 001-1v-4a1 1 0 00-1-1H31a1 1 0 00-1 1v4a1 1 0 001 1m41 6H28a4 4 0 01-4-4V26a4 4 0 014-4h44a4 4 0 014 4v10a4 4 0 01-4 4M31 72h38a1 1 0 001-1v-4a1 1 0 00-1-1H31a1 1 0 00-1 1v4a1 1 0 001 1m41 6H28a4 4 0 01-4-4V64a4 4 0 014-4h44a4 4 0 014 4v10a4 4 0 01-4 4m5-24H67a3 3 0 01-3-3v-2a3 3 0 013-3h10a3 3 0 013 3v2a3 3 0 01-3 3m-22 0H45a3 3 0 01-3-3v-2a3 3 0 013-3h10a3 3 0 013 3v2a3 3 0 01-3 3m-22 0H23a3 3 0 01-3-3v-2a3 3 0 013-3h10a3 3 0 013 3v2a3 3 0 01-3 3" />
    </svg>
  );
}
export default SvgSection;
