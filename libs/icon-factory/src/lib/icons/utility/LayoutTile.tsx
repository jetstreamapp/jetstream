import * as React from 'react';
function SvgLayoutTile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M2 7.52a2.88 2.88 0 012.88-2.88h42.24A2.88 2.88 0 0150 7.52v19.2a2.88 2.88 0 01-2.88 2.88H4.88A2.88 2.88 0 012 26.72zm7.2 28.8a2.39 2.39 0 012.4-2.4h27.84a2.4 2.4 0 110 4.8H11.6a2.39 2.39 0 01-2.4-2.4zm8.16 6.24a2.4 2.4 0 100 4.8h16.32a2.4 2.4 0 000-4.8z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgLayoutTile;
