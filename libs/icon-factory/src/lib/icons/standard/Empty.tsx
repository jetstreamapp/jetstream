import * as React from 'react';
function SvgEmpty(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path
        d="M72 78H28a6 6 0 01-6-6V28a6 6 0 016-6h44a6 6 0 016 6v44a6 6 0 01-6 6zM28 30v40c0 1.1.9 2 2 2h40a2 2 0 002-2V30a2 2 0 00-2-2H30a2 2 0 00-2 2z"
        opacity={0.5}
      />
    </svg>
  );
}
export default SvgEmpty;
