import * as React from 'react';
function SvgHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M49 27h-5v22c0 .6-.4 1-1 1H33c-.6 0-1-.4-1-1V32H20v17c0 .6-.4 1-1 1H9c-.6 0-1-.4-1-1V27H3c-.4 0-.8-.2-.9-.6-.2-.4-.1-.8.2-1.1l23-23c.4-.4 1.1-.4 1.4 0l23 23c.3.3.3.7.2 1.1s-.5.6-.9.6z"
      />
    </svg>
  );
}
export default SvgHome;
