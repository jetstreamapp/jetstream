import * as React from 'react';
function SvgApproval(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M740 540H630c-33 0-60-27-60-60 5-89 46-94 50-151 4-60-34-114-93-127-78-16-147 43-147 118 0 66 45 66 50 160 0 33-27 60-60 60H260c-33 0-60 27-60 60v40c0 11 9 20 20 20h560c11 0 20-9 20-20v-40c0-33-27-60-60-60zm1 180H259c-11 0-19 9-19 19v1c0 33 27 60 60 60h401c33 0 59-27 59-60v-1c0-10-9-19-19-19z" />
    </svg>
  );
}
export default SvgApproval;
