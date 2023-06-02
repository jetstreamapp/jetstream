import * as React from 'react';
function SvgPinned(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M36.9 23.7h-.5L33 7.9h.9c1.6 0 2.9-1.3 2.9-2.9s-1.3-2.9-2.9-2.9H18.1c-1.6 0-2.9 1.3-2.9 2.9s1.3 2.9 2.9 2.9h.9l-3.3 15.8h-.5c-1.6 0-2.9 1.3-2.9 2.9s1.3 2.9 2.9 2.9h8.4v17.4c0 1.6 1.3 3 3 3s3-1.3 3-3V29.6H37c1.6 0 2.9-1.3 2.9-2.9s-1.4-3-3-3z"
      />
    </svg>
  );
}
export default SvgPinned;
