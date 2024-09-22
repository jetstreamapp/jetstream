import * as React from 'react';
function SvgOrchestrator(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M630 214a20 20 0 00-28-12c-12 6-13 18-7 30l91 228c5 11 16 18 27 13a22 22 0 008-31zM503 372c51 0 92 47 92 104s-41 105-92 105-93-47-93-104 41-105 93-105zM289 604l133 15 31 181h-38a23 23 0 01-22-17l-28-98-113-13a60 60 0 01-49-79l59-171a35 35 0 0145-22 36 36 0 0121 46l-49 143a12 12 0 0010 15zm303 196h-40l30-179 126 24a12 12 0 0014-14l-18-80a36 36 0 0126-43 35 35 0 0142 26l26 116a59 59 0 01-67 73l-96-19-20 79a23 23 0 01-23 17zM466 641a14 14 0 01-21-12v-22a14 14 0 0121-12l36 23zm37-23l36-23a14 14 0 0121 12v22a14 14 0 01-21 12z" />
    </svg>
  );
}
export default SvgOrchestrator;
