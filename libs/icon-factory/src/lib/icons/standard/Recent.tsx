import * as React from 'react';
function SvgRecent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M281 480c-1 7-1 13-1 20h-60c0-7 0-13 1-20zm234-120h-30c-8 0-15 7-15 15v131c0 4 2 8 4 11l84 84c6 6 15 6 21 0l21-21c6-6 6-15 0-21l-70-71V375c0-8-7-15-15-15z" />
      <path d="M500 220c-148 0-269 115-279 260 0 3-1 7-1 10h-45c-13 0-20 15-12 24l75 91c6 7 17 7 23 0l75-91c8-10 1-24-12-24h-44v-10c10-112 105-200 219-200 130 0 233 113 219 245-10 95-100 185-196 194-71 7-138-19-185-70-6-7-14-11-22-1l-24 29c-5 6-1 10 4 15 54 57 128 89 208 88 144-2 265-116 275-260 13-163-117-300-278-300z" />
    </svg>
  );
}
export default SvgRecent;
