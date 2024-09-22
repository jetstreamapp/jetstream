import * as React from 'react';
function SvgTarget(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M262 23h-2A187 187 0 0073 210v2c0 130 134 250 176 281a20 20 0 0025 0c42-33 175-151 175-281A190 190 0 00262 23zm-2 52a135 135 0 01106 219c-11-16-34-28-56-37a4 4 0 00-3-1 9 9 0 00-7 0 81 81 0 01-40 12 70 70 0 01-40-12 9 9 0 00-7 0 4 4 0 01-3 1c-22 10-45 21-56 38A136 136 0 01260 75z" />
      <ellipse cx={260} cy={183} rx={56} ry={62} />
    </svg>
  );
}
export default SvgTarget;
