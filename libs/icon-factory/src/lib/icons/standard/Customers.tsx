import * as React from 'react';
function SvgCustomers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <ellipse cx={413} cy={423} rx={122} ry={135} />
      <path d="M526 574a162 162 0 01-226-1c-55 25-110 57-110 107v21c0 25 20 45 45 45h357c25 0 45-20 45-45v-21c-1-50-55-81-111-106m154-100l-5-3c-4-2-9-2-13 1a138 138 0 01-72 21h-10c-5 13-10 26-17 37l14 6c57 25 97 56 125 98h48a40 40 0 0040-40v-19c0-49-57-79-110-101m-11-132c0-49-36-89-79-89-22 0-41 10-56 25 35 36 57 87 57 144v8c43 0 78-39 78-88" />
    </svg>
  );
}
export default SvgCustomers;
