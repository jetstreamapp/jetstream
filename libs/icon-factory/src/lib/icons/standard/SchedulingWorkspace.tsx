import * as React from 'react';
function SvgSchedulingWorkspace(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M588 725h-38c-8 0-13-5-13-13v-25c0-7-5-12-12-12h-50c-8 0-13 5-13 13v25c0 7-5 12-12 12h-38a50 50 0 00-50 50v6a20 20 0 0020 19h237a20 20 0 0019-19v-6a50 50 0 00-50-50zm162-525H250a50 50 0 00-50 50v325a50 50 0 0050 50h500a50 50 0 0050-50V250a50 50 0 00-50-50zM275 531V294a20 20 0 0119-19h75v275h-75a20 20 0 01-19-19zm450 0a20 20 0 01-19 19H444V275h262c10 0 19 9 19 19v236z" />
    </svg>
  );
}
export default SvgSchedulingWorkspace;
