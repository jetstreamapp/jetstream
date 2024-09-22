import * as React from 'react';
function SvgCanvas(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M450 384c-2 27-5 56-10 84-1 8-10 17-18 18a1450 1450 0 01-321 0c-8-1-17-9-18-18a855 855 0 010-268c1-8 10-16 18-18 33-4 65-6 97-8 0 0 26-1 24-26-2-22-40-37-40-74 0-30 30-54 79-54 48 0 78 24 78 54 0 38-37 52-39 74-2 24 24 26 24 26 33 1 66 4 98 8 8 1 17 9 18 18 5 31 8 60 10 91 0 9-7 18-16 18h-9c-9 0-23-7-29-14 0 0-21-22-44-23-37-1-65 31-65 66s28 68 64 67c22-1 44-23 44-23 7-6 20-12 29-12h9c11 0 18 6 17 14z" />
    </svg>
  );
}
export default SvgCanvas;
