import * as React from 'react';
function SvgZoomin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M31 19h-6v-6a1 1 0 00-1-1h-4a1 1 0 00-1 1v6h-6a1 1 0 00-1 1v4a1 1 0 001 1h6v6a1 1 0 001 1h4a1 1 0 001-1v-6h6a1 1 0 001-1v-4a1 1 0 00-1-1zm18.6 26.2L38.1 33.8A20 20 0 0022 2C11 2 2 11 2 22a20 20 0 0031.8 16.1l11.5 11.5c.6.6 1.5.6 2.1 0l2.1-2.1c.6-.6.6-1.6.1-2.3zM22 36c-7.7 0-14-6.3-14-14S14.3 8 22 8s14 6.3 14 14-6.3 14-14 14z" />
    </svg>
  );
}
export default SvgZoomin;
