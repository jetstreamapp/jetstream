import * as React from 'react';
function SvgGraph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M20 455a40 40 0 0040 40h424c9 0 16-7 16-16v-28c0-9-7-16-16-16H95c-8 0-15-7-15-15V41c0-9-7-16-16-16H36c-9 0-16 7-16 16v414zm477-314a30 30 0 00-30-30c-9 0-16 4-22 9l-86 86-59-56-1-1-2-2-2-1-3-2-2-1-4-1-2-1-6-1-6 1-2 1-4 1-2 1-3 2-2 2-3 2-114 115a30 30 0 00-10 22 30 30 0 0030 30c7 0 14-3 19-7l98-97 57 56 3 2 2 2 3 2 2 1 4 1 2 1 6 1 6-1h2l4-1 2-1 3-2 2-1 1-1 1-1 1-1 108-107c5-6 9-13 9-22z" />
    </svg>
  );
}
export default SvgGraph;
