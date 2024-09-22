import * as React from 'react';
function SvgApproval(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M452 292h-88a49 49 0 01-48-48c4-71 37-75 40-121a95 95 0 00-74-101 97 97 0 00-118 94c0 53 36 53 40 128 0 26-22 48-48 48H68a48 48 0 00-48 48v32c0 9 7 16 16 16h448c9 0 16-7 16-16v-32c0-27-22-48-48-48zm1 144H67c-9 0-15 7-15 15v1c0 26 22 48 48 48h321c26 0 47-22 47-48v-1c0-8-7-15-15-15z" />
    </svg>
  );
}
export default SvgApproval;
