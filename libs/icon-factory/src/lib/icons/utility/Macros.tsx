import * as React from 'react';
function SvgMacros(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path
        id="macros_svg__a"
        d="M372 402c-2 4-6 5-10 5h-47a7 7 0 01-7-7l1-4 1-1 2-2 103-125c3-4 4-10 2-14l-1-2-107-127-1-4c0-4 4-7 7-7h47c4 0 8 1 10 5l111 134c2 2 2 5 2 7l-2 8z"
      />
      <use x={-116} href="#macros_svg__a" />
      <path d="M140 402c-2 4-6 5-10 5H42a7 7 0 01-7-7l1-4 1-1 2-2 103-125c3-4 4-10 2-14l-1-2L36 125l-1-4c0-4 4-7 7-7h87c4 0 8 1 10 5l111 134c2 2 2 5 2 7l-2 8z" />
    </svg>
  );
}
export default SvgMacros;
