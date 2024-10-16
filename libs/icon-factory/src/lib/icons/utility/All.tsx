import * as React from 'react';
function SvgAll(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M316 216c-12 0-22-10-22-22V55c0-12 10-22 22-22h142c12 0 22 10 22 22v139c0 12-10 22-22 22H316zm61 82l-82 89c-5 5-5 13 0 19l82 89c5 6 15 6 20 0l82-89c5-5 5-13 0-19l-82-89c-5-6-14-6-20 0zM48 65l72-41c7-4 15-4 21 0l71 41c7 4 11 11 11 19v82c0 8-4 15-11 19l-71 41c-7 4-15 4-21 0l-72-41c-7-4-11-11-11-19V84c0-8 4-15 11-19z" />
      <circle cx={130} cy={394} r={93} />
    </svg>
  );
}
export default SvgAll;
