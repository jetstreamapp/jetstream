import * as React from 'react';
function SvgOrderItem(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M212 519l268 127c12 6 27 6 39 0l269-127c16-8 16-29 0-37L519 355c-12-6-27-6-39 0L212 483c-17 7-17 29 0 36z" />
    </svg>
  );
}
export default SvgOrderItem;
