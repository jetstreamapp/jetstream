import * as React from 'react';
function SvgBan(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 20C128 20 20 128 20 260s108 240 240 240 240-108 240-240S392 20 260 20zm119 257c-1 7-7 13-15 13H156c-8 0-14-5-15-13v-34c1-7 7-13 15-13h208c8 0 14 6 15 13v34z" />
    </svg>
  );
}
export default SvgBan;
