import * as React from 'react';
function SvgWeeklyview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M440 70h-50V50a30 30 0 10-60 0v20H190V50a30 30 0 10-60 0v20H80a40 40 0 00-40 40v25c0 8 7 15 15 15h410c8 0 15-7 15-15v-25a40 40 0 00-40-40zm25 130H55c-8 0-15 7-15 15v245a40 40 0 0040 40h360a40 40 0 0040-40V215c0-8-7-15-15-15zm-137 95l-63 134c-3 7-10 11-18 11-11 0-19-9-19-18l2-8 53-114h-76c-9 0-17-6-17-15 0-8 8-15 17-15h104c10 0 19 8 19 18l-2 7z" />
    </svg>
  );
}
export default SvgWeeklyview;
