import * as React from 'react';
function SvgZoomToLayer(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M29.43 5.72c8.61 1.45 15.41 8.24 16.85 16.85H50v6.86h-3.72c-1.45 8.61-8.24 15.41-16.85 16.85V50h-6.86v-3.72c-8.61-1.45-15.41-8.24-16.85-16.85H2v-6.86h3.72c1.45-8.61 8.24-15.41 16.85-16.85V2h6.86v3.72zM26 12.29c-7.57 0-13.71 6.14-13.71 13.71 0 7.57 6.14 13.71 13.71 13.71S39.71 33.57 39.71 26 33.57 12.29 26 12.29zm0 6.85c3.79 0 6.86 3.07 6.86 6.86 0 3.79-3.07 6.86-6.86 6.86-3.79 0-6.86-3.07-6.86-6.86 0-3.79 3.07-6.86 6.86-6.86z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgZoomToLayer;
