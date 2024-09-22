import * as React from 'react';
function SvgDevice(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M566 379h-33v-33a22 22 0 00-22-22h-22a22 22 0 00-22 22v33h-33a22 22 0 00-22 22v22a22 22 0 0022 22h33v33a22 22 0 0022 22h22a22 22 0 0022-22v-33h33a22 22 0 0022-22v-22a22 22 0 00-22-22zm230-126a50 50 0 00-49-49H253a50 50 0 00-49 49v321a50 50 0 0049 49h494a50 50 0 0049-49zm-74 278a19 19 0 01-18 18H297a19 19 0 01-19-18V296a19 19 0 0119-18h407a19 19 0 0118 18zM586 722h-37a12 12 0 01-12-12v-25a12 12 0 00-12-12h-50a12 12 0 00-12 12v25a12 12 0 01-12 12h-37a50 50 0 00-50 50v6a19 19 0 0019 18h234a19 19 0 0019-18v-6a50 50 0 00-50-50z" />
    </svg>
  );
}
export default SvgDevice;
