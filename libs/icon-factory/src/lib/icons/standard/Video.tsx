import * as React from 'react';
function SvgVideo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M776 334L635 436v-73a34 34 0 00-35-34H235a34 34 0 00-35 34v274a34 34 0 0034 34h367a34 34 0 0035-34v-71l140 100a14 14 0 0024-10V344a14 14 0 00-24-11" />
    </svg>
  );
}
export default SvgVideo;
