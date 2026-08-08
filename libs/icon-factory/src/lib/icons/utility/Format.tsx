import * as React from 'react';
function SvgFormat(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M192 106a16 16 0 000 23l199 199a16 16 0 0023 0l77-76a32 32 0 000-46L314 29a32 32 0 00-46 0zm136 308l5-5 29-30a16 16 0 000-23L162 156a16 16 0 00-22 0l-29 30-2 2-1 1 1-1-2 2-8 8v1l-3 3a52 52 0 00-1 75l32 32 14 14-2 3-3 3c-20 21-44 34-72 43a65 65 0 00-42 78c8 33 40 54 74 49 27-4 45-21 53-47 8-29 24-53 48-73l2 2 3 3 9 9 32 32c21 21 53 21 74 0l4-4 6-6zM62 439c-1 10 8 19 19 20 10 0 20-9 20-20s-9-20-19-20c-11 0-20 9-21 20z"
      />
    </svg>
  );
}
export default SvgFormat;
