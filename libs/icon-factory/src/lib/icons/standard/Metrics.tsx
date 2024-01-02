import * as React from 'react';
function SvgMetrics(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M72 22H28c-3.3 0-6 2.7-6 6v44c0 3.3 2.7 6 6 6h44c3.3 0 6-2.7 6-6V28c0-3.3-2.7-6-6-6zM38 66c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2V55c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v11zm10 0c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2V40c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v26zm10 0c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2V34c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v32zm10 0c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2V47c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v19z"
      />
    </svg>
  );
}
export default SvgMetrics;
