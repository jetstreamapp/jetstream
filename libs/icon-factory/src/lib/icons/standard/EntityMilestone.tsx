import * as React from 'react';
function SvgEntityMilestone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M742 329L531 211a66 66 0 00-64 0L256 330a62 62 0 00-32 54v237c1 22 13 42 32 54l211 119c20 11 44 11 64 0l211-119c20-11 32-32 31-54V383c0-22-12-43-31-54zm-334 76v250c0 12-9 21-21 22-12 0-21-10-21-22V405c-7-7-11-16-11-25 0-18 15-32 33-31s32 15 31 33c0 9-4 17-11 23zm257 157c0 4-2 7-5 9-83 46-129-28-205-4-6 2-12-1-14-7V415c0-4 3-8 7-10 79-30 125 48 209 3 3-1 6 0 7 2l1 3v149z" />
    </svg>
  );
}
export default SvgEntityMilestone;
