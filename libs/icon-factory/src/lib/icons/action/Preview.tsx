import * as React from 'react';
function SvgPreview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M518 251a288 288 0 00-516 0c-3 6-3 13 0 18a288 288 0 00516 0c3-6 3-12 0-18zM260 370c-61 0-110-49-110-110s49-110 110-110 110 49 110 110-49 110-110 110zm0-180c-39 0-70 31-70 70s31 70 70 70 70-31 70-70-31-70-70-70z" />
    </svg>
  );
}
export default SvgPreview;
