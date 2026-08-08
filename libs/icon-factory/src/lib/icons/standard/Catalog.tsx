import * as React from 'react';
function SvgCatalog(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M618 294l89 89c20 19 20 51 0 70L475 684V366l72-72c19-20 52-20 71 0m182 331v125c0 28-22 50-50 50H438l225-225h87c28 0 50 23 50 50m-600 63V250c0-28 22-50 50-50h125c28 0 50 22 50 50v438c0 62-50 112-112 112s-113-50-113-112m112 50c28 0 50-22 50-50s-22-50-50-50-50 22-50 50 23 50 50 50" />
    </svg>
  );
}
export default SvgCatalog;
