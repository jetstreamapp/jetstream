import * as React from 'react';
function SvgGoal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M50 20c-17 0-30 13-30 30v420c0 16 13 30 30 30 16 0 30-13 30-30V50c0-17-13-30-30-30zm438 45c-130 68-233-49-356-4-6 2-12 8-12 15v224c0 11 12 19 23 16 118-35 220 76 348 6 5-3 9-8 9-14V72c0-6-7-10-12-7zm-28 227l-5 2c-10 5-26 6-53 6h-2v-50c-15 0-42-3-60-7v53l-46-9-14-4v-55c-17-5-43-10-60-14v57c-12-2-15-3-28-3l-16 1-16 1v-58c10-2 22-2 35-2s14 1 25 3v-60c-11-2-50-2-60 1V92l9-1c10-1 40 1 51 4v58l56 13 4 1v-58c18 5 39 11 60 14v57c17 3 44 5 60 5v-55h2c16 0 27-4 47-7l12-4v60c-18 5-37 7-56 7h-4v64h2c19 0 40-7 58-15v57z" />
      <path d="M280 167v60l12 4c15 4 31 9 48 12v-62z" />
    </svg>
  );
}
export default SvgGoal;
