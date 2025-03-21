import * as React from 'react';
function SvgLogACall(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M697 200H321c-33 0-61 30-61 60v20h-20c-22 0-40 18-40 40s18 40 40 40h20v100h-20c-22 0-40 18-40 40s18 40 40 40h20v100h-20c-22 0-40 18-40 40s18 40 40 40h20v20c0 30 28 60 61 60h376c33 0 63-30 63-63V257c0-33-30-57-63-57zm-36 403l-28 28c-6 6-15 10-23 9a264 264 0 01-249-249c0-9 3-17 9-23l28-28c13-13 35-12 46 3l26 32c9 11 9 26 1 38l-22 31c-3 4-3 10 1 13l46 51 51 46c4 4 9 4 13 1l31-22c11-8 27-8 38 1l32 26c12 8 13 30 0 43z" />
    </svg>
  );
}
export default SvgLogACall;
