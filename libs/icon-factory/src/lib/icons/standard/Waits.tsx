import * as React from 'react';
function SvgWaits(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M800 405c0-10-9-19-19-19H519c-10 0-19 9-19 19v37c0 10 9 19 19 19h178L504 698l-1 1c-2 3-4 7-4 11v37c0 10 9 19 19 19h263c10 0 19-9 19-19v-37c0-10-9-19-19-19H606l190-233c3-4 4-8 3-13v-40zM500 253c0-10-9-19-19-19H219c-10 0-19 9-19 19v37c0 10 9 19 19 19h178L204 546l-1 1c-2 3-3 6-3 10v37c0 10 9 19 19 19h263c10 0 19-9 19-19v-37c0-10-9-19-19-19H306l190-233c3-4 4-8 3-13v-39z" />
    </svg>
  );
}
export default SvgWaits;
