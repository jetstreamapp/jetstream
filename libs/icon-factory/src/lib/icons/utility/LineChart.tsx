import * as React from 'react';
function SvgLineChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M80 20c-33 0-60 27-60 60v360c0 33 27 60 60 60h360c33 0 60-27 60-60V80c0-33-27-60-60-60zm310 123v-1h1c7-7 19-8 27 0l15 13c7 8 8 20 1 28l-3 3-11 12-1 2-113 118a32 32 0 01-44 2l-49-45-72 72-1 1-14 14v1a20 20 0 01-28-1l-14-14a20 20 0 01-1-28l106-106a32 32 0 0144-1l49 44 106-112z" />
    </svg>
  );
}
export default SvgLineChart;
