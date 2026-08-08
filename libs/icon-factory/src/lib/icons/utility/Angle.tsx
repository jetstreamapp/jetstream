import * as React from 'react';
function SvgAngle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M474 352L69 498a34 34 0 01-44-43L165 43c7-21 32-30 51-17a959 959 0 01275 276c12 18 4 43-17 50" />
      <path d="M216 26c-19-13-44-4-51 17L25 455c-9 27 17 53 44 43l405-146c21-7 30-32 17-50A960 960 0 00216 26" />
    </svg>
  );
}
export default SvgAngle;
