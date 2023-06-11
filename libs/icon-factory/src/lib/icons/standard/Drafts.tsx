import * as React from 'react';
function SvgDrafts(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M73 20H41c-3.3 0-6 2.7-6 6v1c0 .6.4 1 1 1h29c3.3 0 6 2.7 6 6v31c0 .6.4 1 1 1h1c3.3 0 6-2.7 6-6V26c0-3.3-2.7-6-6-6z"
      />
      <path
        fill="unset"
        d="M59 34H27c-3.3 0-6 2.7-6 6v34c0 3.3 2.7 6 6 6h32c3.3 0 6-2.7 6-6V40c0-3.3-2.7-6-6-6zM29 44c0-1.1.9-2 2-2h20c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H31c-1.1 0-2-.9-2-2v-2zm24 26c0 1.1-.9 2-2 2H31c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h20c1.1 0 2 .9 2 2v2zm4-12c0 1.1-.9 2-2 2H31c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h24c1.1 0 2 .9 2 2v2z"
      />
    </svg>
  );
}
export default SvgDrafts;
