import * as React from 'react';
function SvgFavorite(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M274 31l46 150c2 6 8 9 14 9h150c15 0 21 20 9 29l-122 90c-5 4-7 11-5 17l58 154c4 14-11 26-23 17l-131-98c-5-4-12-4-18 0l-132 98c-12 9-28-3-23-17l56-154c2-6 0-13-5-17L26 219c-12-9-5-29 9-29h150c7 0 12-2 14-9l47-151c4-14 24-13 28 1z" />
    </svg>
  );
}
export default SvgFavorite;
