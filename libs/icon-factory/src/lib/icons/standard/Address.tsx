import * as React from 'react';
function SvgAddress(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M490 189a237 237 0 00-237 239c0 165 170 316 222 356a25 25 0 0031 0c53-42 221-191 221-356a237 237 0 00-237-239m0 337a100 100 0 11100-100 100 100 0 01-100 100" />
    </svg>
  );
}
export default SvgAddress;
