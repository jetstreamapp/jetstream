import * as React from 'react';
function SvgCarousel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M763 377h-27v269h27a38 38 0 0037-37V414a38 38 0 00-37-37zm-563 37v195a38 38 0 0037 37h27V377h-27a38 38 0 00-37 37zm465-71H335a38 38 0 00-37 38v262a38 38 0 0037 37h330a38 38 0 0037-37V381a38 38 0 00-37-38zm-56 270H378a12 12 0 01-10-19l70-121a8 8 0 0113 0l43 72a8 8 0 0013 1l34-50a8 8 0 0114 0l63 100a10 10 0 01-9 17zm-6-144a32 32 0 1132-32 32 32 0 01-32 32z" />
    </svg>
  );
}
export default SvgCarousel;
