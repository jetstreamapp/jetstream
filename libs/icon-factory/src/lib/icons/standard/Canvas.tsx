import * as React from 'react';
function SvgCanvas(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M739 659c-2 34-6 71-12 106-2 11-12 21-23 22a1552 1552 0 01-406 0c-11-1-21-12-23-22a965 965 0 01-1-338c2-11 12-21 23-23 41-5 82-8 122-10 0 0 33-2 31-32-2-28-50-46-50-94 0-38 38-68 99-68s99 31 99 68c0 47-47 66-49 94-2 31 30 32 30 32 41 2 83 5 124 10 11 2 21 12 23 23 7 39 11 74 13 112 1 11-9 20-21 20l-11-1c-12 0-29-7-37-16 0 0-27-27-55-27-46-1-82 41-82 85s35 86 81 85c28-1 55-29 55-29 9-8 25-16 37-16l11-1c14 1 23 10 22 20z" />
    </svg>
  );
}
export default SvgCanvas;
