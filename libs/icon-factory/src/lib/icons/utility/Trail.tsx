import * as React from 'react';
function SvgTrail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M278 20a59 59 0 110 118 59 59 0 010-118zm152 161c-12-1-23 7-24 18l-6 58c-2 0-3 3-5 3h-55l-38-67c-3-6-9-11-16-12l-58-8c-10-1-20 4-24 14l-44 113c-3 9 1 18 9 23l108 74 9 84c1 11 11 19 22 19 13 0 23-10 22-22l-10-103c0-5-3-10-8-14l-59-66 22-54 26 45c4 6 11 13 19 13h76l-22 180c-1 11 7 20 19 21l2-1c11 0 20-8 22-19l33-278c1-10-8-20-20-21zm-308 96l37-95 9-18-5-1a67 67 0 00-72 44l-20 52a20 20 0 0014 27l9 2c12 5 24-1 28-11zm14 75L91 486c-2 7 3 13 10 13h25c9 0 18-6 21-14l44-97-50-31z" />
    </svg>
  );
}
export default SvgTrail;
