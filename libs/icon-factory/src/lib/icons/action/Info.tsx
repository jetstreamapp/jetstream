import * as React from 'react';
function SvgInfo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 20a239 239 0 100 480 239 239 0 100-480zm0 121c17 0 30 13 30 30s-13 30-30 30-30-13-30-30 13-30 30-30zm50 210c0 5-4 9-10 9h-80c-5 0-10-3-10-9v-20c0-5 4-11 10-11 5 0 10-3 10-9v-40c0-5-4-11-10-11-5 0-10-3-10-9v-20c0-5 4-11 10-11h60c5 0 10 5 10 11v80c0 5 4 9 10 9 5 0 10 5 10 11z" />
    </svg>
  );
}
export default SvgInfo;
