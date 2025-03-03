import * as React from 'react';
function SvgToday(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M500 200c-165 0-300 135-300 300s135 300 300 300 300-135 300-300-135-300-300-300zm0 540c-132 0-240-108-240-240s108-240 240-240 240 108 240 240-108 240-240 240zm30-252V360c0-11-9-20-20-20h-20c-11 0-20 9-20 20v140c0 8 3 16 9 21l96 96c8 8 20 8 28 0l14-14c8-8 8-20 0-28z" />
    </svg>
  );
}
export default SvgToday;
