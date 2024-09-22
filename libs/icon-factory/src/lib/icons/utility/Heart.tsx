import * as React from 'react';
function SvgHeart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M294 451c-19 20-50 20-70 0L57 271a139 139 0 010-189 123 123 0 01180 0l10 12c7 8 20 8 26 0l8-10 1-2a122 122 0 01180 0 140 140 0 010 189c0 2-110 119-168 180z" />
    </svg>
  );
}
export default SvgHeart;
