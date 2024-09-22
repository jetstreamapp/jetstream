import * as React from 'react';
function SvgImage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M500 100a40 40 0 00-40-40H60a40 40 0 00-40 40v320a40 40 0 0040 40h400a40 40 0 0040-40V100zM396 380H106a15 15 0 01-13-23l88-153c4-7 13-7 17 0l53 91c4 6 13 7 17 1l43-62a10 10 0 0117 0l79 126c6 9 0 20-11 20zm-26-180c-22 0-40-18-40-40s18-40 40-40 40 18 40 40-18 40-40 40z" />
    </svg>
  );
}
export default SvgImage;
