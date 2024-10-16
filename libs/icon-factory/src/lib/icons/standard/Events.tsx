import * as React from 'react';
function SvgEvents(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M714 286c-55-55-128-86-205-86-17 0-30 13-30 30s13 30 30 30c61 0 119 24 163 67 43 45 68 103 68 164 0 17 13 30 30 30s30-13 30-30c0-77-30-150-86-205zm-205 35c-17 0-30 13-30 30s13 30 30 30a110 110 0 01110 110c0 17 13 30 30 30s30-13 30-30a170 170 0 00-170-170zm-43 287l26-70c18 7 38 3 53-11 20-20 20-51 0-71a50 50 0 00-71 0 51 51 0 00-10 56l-65 29-117-117c-8-8-22-8-29 1-75 90-70 224 15 309 84 84 218 89 309 15 9-7 9-21 1-29z" />
    </svg>
  );
}
export default SvgEvents;
