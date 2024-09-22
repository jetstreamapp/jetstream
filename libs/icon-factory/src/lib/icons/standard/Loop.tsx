import * as React from 'react';
function SvgLoop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M765 583l-1 2-11 33-16 34c-12 22-27 42-45 60a271 271 0 01-129 77 286 286 0 1169-522h1a242 242 0 0168 56c9 8 16 3 16-9v-94c0-11 9-20 20-20h40c11 0 20 9 22 20v245c0 9-8 18-18 18H536c-11 0-19-8-19-19v-42c0-11 9-20 20-20h94c8 0 14-2 17-7a201 201 0 1027 186s3-18 17-18h57c8 0 16 6 16 15v5z" />
    </svg>
  );
}
export default SvgLoop;
