import * as React from 'react';
function SvgChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M455 234L250 347a20 20 0 01-30-18V84c0-10-10-18-19-15a220 220 0 10276 175c-2-10-13-15-22-10zm-178 46l197-105c12-6 16-22 8-33A302 302 0 00287 22c-14-3-27 8-27 22v226c0 9 9 14 17 10z" />
    </svg>
  );
}
export default SvgChart;
