import * as React from 'react';
function SvgHideMobile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M361 253v141c0 7-6 14-14 14H206l-86 86c6 4 13 6 20 6h240c20 0 37-17 37-37V197zM260 481c-16 0-28-12-28-28s12-28 28-28 28 12 28 28-12 28-28 28zm-157-25l57-57v-1l202-202v1l55-55v-1l70-70c7-6 8-17 3-22l-20-19c-6-6-16-5-22 3l-31 31v-7c0-20-17-37-37-37H140c-20 0-37 17-37 37v321l-71 71c-6 6-7 16-2 21l19 20c6 6 16 5 22-3zm55-348c0-7 6-14 14-14h175c7 0 14 6 14 14v12L158 322z" />
    </svg>
  );
}
export default SvgHideMobile;
