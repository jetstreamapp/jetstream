import * as React from 'react';
function SvgVisualization(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M78 72V28a6 6 0 00-6-6H28a6 6 0 00-6 6v44a6 6 0 006 6h44a6 6 0 006-6M34 38a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h11a2 2 0 012 2v2a2 2 0 01-2 2zm0 10a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h26a2 2 0 012 2v2a2 2 0 01-2 2zm0 10a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h32a2 2 0 012 2v2a2 2 0 01-2 2zm0 10a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h19a2 2 0 012 2v2a2 2 0 01-2 2z" />
    </svg>
  );
}
export default SvgVisualization;
