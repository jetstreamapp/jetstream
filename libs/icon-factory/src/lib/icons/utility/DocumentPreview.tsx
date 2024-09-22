import * as React from 'react';
function SvgDocumentPreview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M172 116h176c9 0 16-7 16-16V68c0-26-22-48-48-48H204a49 49 0 00-48 48v32c0 9 7 16 16 16zm264-56h-16c-5 0-8 3-8 8v32c0 35-29 64-64 64H172a64 64 0 01-64-64V68c0-5-3-8-8-8H84a49 49 0 00-48 48v344c0 26 22 48 48 48h352c26 0 48-22 48-48V108c0-26-22-48-48-48zM153 326a122 122 0 01218 0v8a122 122 0 01-218 0 8 8 0 010-8zm109 54c27 0 50-22 50-50s-23-50-50-50-50 22-50 50 22 50 50 50zm0-80c16 0 30 13 30 30s-14 30-30 30-30-13-30-30 13-30 30-30z" />
    </svg>
  );
}
export default SvgDocumentPreview;
