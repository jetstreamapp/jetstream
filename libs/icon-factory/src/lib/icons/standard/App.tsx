import * as React from 'react';
function SvgApp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M62 28H31.5c-1.7 0-3.1 1.4-3.1 3.1v30.5h-4.6c-2.1 0-3.8-1.7-3.8-3.8V23.3c0-2.1 1.7-3.8 3.8-3.8h34.5c2.1 0 3.8 1.7 3.8 3.8V28z"
      />
      <path
        fill="unset"
        d="M41.8 37.6h34.5c2.1 0 3.8 1.7 3.8 3.8v34.5c0 2.1-1.7 3.8-3.8 3.8H41.8c-2.1 0-3.8-1.7-3.8-3.8V41.3c0-2 1.7-3.7 3.8-3.7z"
      />
    </svg>
  );
}
export default SvgApp;
