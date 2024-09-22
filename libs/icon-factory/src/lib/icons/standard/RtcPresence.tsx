import * as React from 'react';
function SvgRtcPresence(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M616 198c-112 0-203 86-203 193a188 188 0 0026 94 16 16 0 012 11l-19 62a14 14 0 0017 17l59-21a15 15 0 0111 1 208 208 0 00106 29c112 0 203-87 203-193s-91-193-202-193zM458 762v13a28 28 0 01-28 28H210a28 28 0 01-28-28v-13c0-33 40-54 76-70a14 14 0 004-2 9 9 0 019 0 90 90 0 0050 15 94 94 0 0050-14 9 9 0 018 0 14 14 0 014 2c36 15 75 36 75 69z" />
      <ellipse cx={320} cy={603} rx={69} ry={76} />
    </svg>
  );
}
export default SvgRtcPresence;
