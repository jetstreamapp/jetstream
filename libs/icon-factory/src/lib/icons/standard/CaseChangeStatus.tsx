import * as React from 'react';
function SvgCaseChangeStatus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M380 300h40c6 0 10-4 10-10v-30h140v30c0 6 4 10 10 10h40c6 0 10-4 10-10v-30c0-33-27-60-60-60H430c-33 0-60 27-60 60v30c0 6 4 10 10 10zm360 60H260c-33 0-60 27-60 60v320c0 33 27 60 60 60h480c33 0 60-27 60-60V420c0-33-27-60-60-60zM585 581L480 707c-6 6-16 1-14-7l26-90h-69c-8 0-14-8-11-16l42-108c4-9 12-15 22-15h83c9 0 15 9 10 17l-45 72h52c10 0 16 13 9 21z" />
    </svg>
  );
}
export default SvgCaseChangeStatus;
