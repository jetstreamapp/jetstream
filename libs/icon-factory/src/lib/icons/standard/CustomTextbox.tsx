import * as React from 'react';
function SvgCustomTextbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M775 595h7l6-7c16-16 16-40 1-55l-20-20c-16-13-38-7-50 5l-7 7q-3 3 0 6zm-83-44c-2-2-5-2-7 0L558 677c-7 7-12 15-15 25l-19 62c-2 4-1 8 1 11 2 5 7 7 12 7h4l63-20c9-3 18-8 25-15l126-126c2-2 2-5 0-7l-63-64zm-96 185l-38 12 12-38c1-5 4-9 8-13l31 31c-4 4-9 6-13 8m59-518c28 0 51 22 51 50v216l-8 6-4 4-6 6-13 13-14 13-23 22V302c0-9-7-17-17-17H285c-9 0-17 8-17 17v337c0 9 8 17 17 17h245c-8 9-14 18-18 29l-2 6-10 32H251c-28 0-51-23-51-50V268c0-28 23-51 51-51h404z" />
      <path d="M580 656l-22 21-5 5-4 6 9-11 21-21zM387 353c9 0 17 8 17 17v201c0 9-8 16-17 16h-34c-9 0-16-7-16-16V370c0-9 7-17 16-17z" />
    </svg>
  );
}
export default SvgCustomTextbox;
