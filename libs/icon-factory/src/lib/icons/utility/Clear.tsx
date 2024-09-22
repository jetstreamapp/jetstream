import * as React from 'react';
function SvgClear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 20a240 240 0 100 480 240 240 0 100-480zm49 248l78 78c4 4 4 10 0 14l-28 28a10 10 0 01-14 0l-78-78a10 10 0 00-14 0l-78 78a10 10 0 01-14 0l-28-28a10 10 0 010-14l78-78c4-4 4-10 0-14l-79-79a10 10 0 010-14l28-28a10 10 0 0114 0l79 79c4 4 10 4 14 0l78-78a10 10 0 0114 0l28 28c4 4 4 10 0 14l-78 78c-3 4-3 10 0 14z" />
    </svg>
  );
}
export default SvgClear;
