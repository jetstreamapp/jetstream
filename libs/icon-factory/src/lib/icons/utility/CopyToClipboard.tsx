import * as React from 'react';
function SvgCopyToClipboard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M174 116h173c9 0 16-7 16-16V68c0-26-21-48-47-48H206a48 48 0 00-47 48v32c-1 9 6 16 15 16zm259-56h-16c-5 0-8 3-8 8v32c0 35-28 64-63 64H174a64 64 0 01-63-64V68c0-5-3-8-8-8H87a48 48 0 00-47 48v344c0 26 21 48 47 48h346c26 0 47-22 47-48V108c0-26-21-48-47-48z" />
    </svg>
  );
}
export default SvgCopyToClipboard;
