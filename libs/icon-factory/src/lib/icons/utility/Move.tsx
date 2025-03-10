import * as React from 'react';
function SvgMove(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M497 253l-83-90c-6-6-14-1-14 9v58H300c-6 0-10-4-10-10V120h59c10 0 15-9 9-14l-90-83c-4-3-10-3-14 0l-90 83c-6 6-1 14 9 14h57v100c0 6-4 10-10 10H120v-59c0-10-9-15-14-9l-83 90c-3 4-3 10 0 14l83 90c6 6 14 1 14-9v-57h100c6 0 10 4 10 10v100h-59c-10 0-15 9-9 14l90 83c4 3 10 3 14 0l90-83c6-6 1-14-9-14h-57V300c0-6 4-10 10-10h100v59c0 10 9 15 14 9l83-90c4-5 4-11 0-15z" />
    </svg>
  );
}
export default SvgMove;
