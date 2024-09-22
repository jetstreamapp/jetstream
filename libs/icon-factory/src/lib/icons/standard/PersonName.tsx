import * as React from 'react';
function SvgPersonName(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M717 200H282c-46 0-83 36-82 78v444a70 70 0 003 22 412 412 0 0177-39c44-18 49-34 49-51s-13-34-27-48a122 122 0 01-39-90c0-68 44-126 120-126s120 59 120 126a113 113 0 01-38 90c-14 13-27 30-27 48s6 33 49 51c56 23 110 50 121 95h110a81 81 0 0082-78V278a81 81 0 00-83-78zm-7 259a20 20 0 01-20 20H540a20 20 0 01-20-20v-30a20 20 0 0120-20h150a20 20 0 0120 20zm50-130a20 20 0 01-20 20H540a20 20 0 01-20-20v-30a20 20 0 0120-20h200a20 20 0 0120 20z" />
    </svg>
  );
}
export default SvgPersonName;
