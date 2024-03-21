import * as React from 'react';
function SvgAddress(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M49 18.92a23.74 23.74 0 00-23.73 23.85c0 16.48 17 31.59 22.23 35.59a2.45 2.45 0 003.12 0c5.24-4.12 22.1-19.11 22.1-35.59A23.74 23.74 0 0049 18.92zm0 33.71a10 10 0 1110-10 10 10 0 01-10 10z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgAddress;
