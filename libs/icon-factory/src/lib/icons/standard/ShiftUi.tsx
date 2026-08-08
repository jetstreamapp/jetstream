import * as React from 'react';
function SvgShiftUi(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M77.5 67.9c1.37 0 2.5 1.12 2.5 2.49v7.11c0 1.37-1.12 2.49-2.5 2.49H52.25c-1.38 0-2.5-1.12-2.5-2.49v-7.11c0-1.37 1.13-2.49 2.5-2.49H77.5zm0-28.94c1.37 0 2.5 1.12 2.5 2.49v16.96c0 1.37-1.12 2.49-2.5 2.49h-55c-1.37 0-2.5-1.12-2.5-2.49V41.45c0-1.37 1.13-2.49 2.5-2.49h55zM47.75 20c1.37 0 2.5 1.12 2.5 2.49v7.11c0 1.37-1.13 2.49-2.5 2.49H22.5c-1.37 0-2.5-1.12-2.5-2.49v-7.11c0-1.37 1.13-2.49 2.5-2.49h25.25z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgShiftUi;
