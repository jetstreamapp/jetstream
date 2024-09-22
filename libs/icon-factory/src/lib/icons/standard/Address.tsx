import * as React from 'react';
function SvgAddress(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M49 18.9a23.7 23.7 0 00-23.7 23.9c0 16.5 17 31.6 22.2 35.6a2.5 2.5 0 003.1 0c5.3-4.2 22.1-19.1 22.1-35.6A23.7 23.7 0 0049 18.9zm0 33.7a10 10 0 1110-10 10 10 0 01-10 10z" />
    </svg>
  );
}
export default SvgAddress;
