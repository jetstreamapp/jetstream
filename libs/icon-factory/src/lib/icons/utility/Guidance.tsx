import * as React from 'react';
function SvgGuidance(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 20C128 20 20 128 20 260s108 240 240 240 240-108 240-240S392 20 260 20zm0 416c-97 0-176-80-176-176S164 84 260 84s176 80 176 176-80 176-176 176zm93-279l-133 48c-7 2-13 8-15 15l-48 133a8 8 0 0010 10l133-48c7-2 13-8 15-15l48-133a8 8 0 00-10-10zm-93 135c-18 0-32-14-32-32s14-32 32-32 32 14 32 32-14 32-32 32z" />
    </svg>
  );
}
export default SvgGuidance;
