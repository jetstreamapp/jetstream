import * as React from 'react';
function SvgDataset(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M52 20.6l23.4 11.5c1.6.8 2.6 2.4 2.6 4.1V63c0 1.8-1 3.4-2.6 4.1L52 78.6c-1.3.6-2.8.6-4.1 0L24.6 67.1C23 66.3 22 64.7 22 63V36.2c0-1.8 1-3.4 2.6-4.1L48 20.6c1.2-.6 2.8-.6 4 0z"
      />
    </svg>
  );
}
export default SvgDataset;
