import * as React from 'react';
function SvgSpacer(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M3 1v16a2 2 0 002 2h42a2 2 0 002-2V1h-4v14H7V1zm46 50V35a2 2 0 00-2-2H5a2 2 0 00-2 2v16h4V37h38v14zM12 28H4v-4h8zm4 0h8v-4h-8zm20 0h-8v-4h8zm4 0h8v-4h-8z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgSpacer;
