import * as React from 'react';
function SvgOverflow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M37.3 9.9H15.8c-2.1 0-3.7 1.7-3.7 3.7v.6c0 .3.3.6.6.6h19.6c2.1 0 3.7 1.7 3.7 3.7v22.1c0 .3.3.6.6.6h.6c2.1 0 3.7-1.7 3.7-3.7V13.6c.1-2-1.6-3.7-3.6-3.7z"
      />
      <path
        fill="unset"
        d="M45.3 2H23.8c-2.1 0-3.7 1.7-3.7 3.7v.6c0 .3.3.6.6.6h19.6c2.1 0 3.7 1.7 3.7 3.7v22.1c0 .3.3.6.6.6h.6c2.1 0 3.7-1.7 3.7-3.7V5.7c.1-2-1.6-3.7-3.6-3.7z"
      />
      <path
        fill="unset"
        d="M32.6 21.8c0-2-1.7-3.7-3.7-3.7H6.7c-2.1 0-3.7 1.7-3.7 3.7v24.5c0 2 1.7 3.7 3.7 3.7h22.2c2.1 0 3.7-1.7 3.7-3.7V21.8z"
      />
    </svg>
  );
}
export default SvgOverflow;
