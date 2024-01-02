import * as React from 'react';
function SvgEmail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M24.9 30.1c.6.6 1.5.6 2.1 0l22.6-21c.5-.8.4-2.1-1.2-2.1l-44.8.1c-1.2 0-2.2 1.1-1.3 2.1l22.6 20.9z" />
        <path d="M50 17.3c0-1-1.2-1.6-2-.9L30.3 32.7c-1.2 1.1-2.7 1.7-4.3 1.7s-3.1-.6-4.3-1.6L4.1 16.4c-.8-.7-2-.2-2 .9C2 21.8 2 34 2 40c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V17.3z" />
      </g>
    </svg>
  );
}
export default SvgEmail;
