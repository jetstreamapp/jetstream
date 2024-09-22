import * as React from 'react';
function SvgLabel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M488 291L378 401a40 40 0 01-28 14l-284 1c-25 0-44-20-45-44l-1-222a46 46 0 0145-44l280-2a35 35 0 0127 10l115 114a46 46 0 010 63z" />
    </svg>
  );
}
export default SvgLabel;
