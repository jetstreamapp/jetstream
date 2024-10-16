import * as React from 'react';
function SvgVisualization(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M78 72V28c0-3.3-2.7-6-6-6H28c-3.3 0-6 2.7-6 6v44c0 3.3 2.7 6 6 6h44c3.3 0 6-2.7 6-6zM34 38c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h11c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H34zm0 10c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h26c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H34zm0 10c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h32c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H34zm0 10c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h19c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H34z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgVisualization;
