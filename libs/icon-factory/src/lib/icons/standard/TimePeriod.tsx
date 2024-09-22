import * as React from 'react';
function SvgTimePeriod(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M76 42H24a2 2 0 00-2 2v30a6 6 0 006 6h44a6 6 0 006-6V44a2 2 0 00-2-2zM40 70a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4c0-1.1.9-2 2-2h4a2 2 0 012 2zm14 0a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4c0-1.1.9-2 2-2h4a2 2 0 012 2zm0-14a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4c0-1.1.9-2 2-2h4a2 2 0 012 2zm14 0a2 2 0 01-2 2h-4a2 2 0 01-2-2v-4c0-1.1.9-2 2-2h4a2 2 0 012 2zm4-30h-5v-2c0-2.2-1.8-4-4-4s-4 1.8-4 4v2H41v-2c0-2.2-1.8-4-4-4s-4 1.8-4 4v2h-5a6 6 0 00-6 6v2c0 1.1.9 2 2 2h52a2 2 0 002-2v-2a6 6 0 00-6-6z" />
    </svg>
  );
}
export default SvgTimePeriod;
