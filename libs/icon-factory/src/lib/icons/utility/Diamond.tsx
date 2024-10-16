import * as React from 'react';
function SvgDiamond(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M244 492c9 9 22 9 31 0l219-219c9-9 9-22 0-31L276 24c-9-9-22-9-31 0L26 243c-9 9-9 22 0 31z" />
    </svg>
  );
}
export default SvgDiamond;
