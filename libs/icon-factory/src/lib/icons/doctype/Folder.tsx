import * as React from 'react';
function SvgFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path
        fill="#032d60"
        d="M5148 1546a452 452 0 01452 454v3100a452 452 0 01-452 452H448A452 452 0 010 5100V1300a452 452 0 01452-448h1148c382 0 423 114 674 445 207 274 711 249 1039 249z"
      />
      <path fill="#90d0fe" d="M5148 1812H924a452 452 0 00-452 452v284l447-648h4235l446 649v-285a452 452 0 00-452-452z" />
      <path
        fill="#1ab9ff"
        d="M457 5548h4691a452 452 0 00452-448V2348a452 452 0 00-452-448H925a452 452 0 00-452 452v2748a465 465 0 01-6 72 233 233 0 01-460 0 450 450 0 00450 376z"
      />
    </svg>
  );
}
export default SvgFolder;
