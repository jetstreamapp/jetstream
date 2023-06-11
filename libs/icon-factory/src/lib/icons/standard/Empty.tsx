import * as React from 'react';
function SvgEmpty(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        opacity={0.5}
        fill="unset"
        d="M72 78H28c-3.3 0-6-2.7-6-6V28c0-3.3 2.7-6 6-6h44c3.3 0 6 2.7 6 6v44c0 3.3-2.7 6-6 6zM28 30v40c0 1.1.9 2 2 2h40c1.1 0 2-.9 2-2V30c0-1.1-.9-2-2-2H30c-1.1 0-2 .9-2 2z"
      />
    </svg>
  );
}
export default SvgEmpty;
