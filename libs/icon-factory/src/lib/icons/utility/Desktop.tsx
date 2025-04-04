import * as React from 'react';
function SvgDesktop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M500 60a40 40 0 00-40-40H60a40 40 0 00-40 40v260a40 40 0 0040 40h400a40 40 0 0040-40V60zm-60 225c0 8-7 15-15 15H95c-8 0-15-7-15-15V95c0-8 7-15 15-15h330c8 0 15 7 15 15v190zM330 440h-30c-6 0-10-4-10-10v-20c0-6-4-10-10-10h-40c-6 0-10 4-10 10v20c0 6-4 10-10 10h-30a40 40 0 00-40 40v5c0 8 7 15 15 15h190c8 0 15-7 15-15v-5a40 40 0 00-40-40z" />
    </svg>
  );
}
export default SvgDesktop;
