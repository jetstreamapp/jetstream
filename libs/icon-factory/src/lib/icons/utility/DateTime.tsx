import * as React from 'react';
function SvgDateTime(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M436 68h-40V52c0-18-14-32-32-32s-32 14-32 32v16H188V52c0-18-14-32-32-32s-32 14-32 32v16H84c-26 0-48 22-48 48v16c0 9 7 16 16 16h416c9 0 16-7 16-16v-16c0-26-22-48-48-48zm32 128H52c-9 0-16 7-16 16v240c0 26 22 48 48 48h352c26 0 48-22 48-48V212c0-9-7-16-16-16zM260 467a119 119 0 010-238c65 0 119 54 119 119a119 119 0 01-119 119zm12-124v-51c0-4-4-8-8-8h-8c-4 0-8 4-8 8v56c0 3 1 6 4 8l38 38c3 3 8 3 11 0l6-6c3-3 3-8 0-11z" />
    </svg>
  );
}
export default SvgDateTime;
