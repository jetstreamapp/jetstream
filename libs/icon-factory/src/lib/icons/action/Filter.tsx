import * as React from 'react';
function SvgFilter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M48.2 4H3.8C2.4 4 1.6 5.7 2.5 6.8L22 29.5c.6.7 1 1.7 1 2.6v14.4c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5V32.1c0-1 .3-1.9 1-2.6L49.5 6.8c.9-1.1.2-2.8-1.3-2.8z"
      />
    </svg>
  );
}
export default SvgFilter;
