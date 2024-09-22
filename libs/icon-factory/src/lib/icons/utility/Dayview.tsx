import * as React from 'react';
function SvgDayview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M440 70h-50V50a30 30 0 10-60 0v20H190V50a30 30 0 10-60 0v20H80a40 40 0 00-40 40v25c0 8 7 15 15 15h410c8 0 15-7 15-15v-25a40 40 0 00-40-40zm25 130H55c-8 0-15 7-15 15v245a40 40 0 0040 40h360a40 40 0 0040-40V215c0-8-7-15-15-15zM290 420v2c0 8-10 18-20 18s-20-10-20-20V320l-15 16c-3 3-6 4-10 4-8 0-15-7-15-15 0-4 2-8 5-11l39-39a20 20 0 0115-6c11 0 21 9 21 20v131z" />
    </svg>
  );
}
export default SvgDayview;
