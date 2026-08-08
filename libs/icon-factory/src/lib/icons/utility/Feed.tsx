import * as React from 'react';
function SvgFeed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M181 90c11 1 21 8 24 21l54 220 71-158c5-10 14-16 25-16h4c8 2 16 8 20 16l1 2 37 86h63c11 0 20 9 20 20v14c0 11-9 20-20 20h-80c-11 0-20-6-25-16l-20-47-78 173v1c-6 8-14 14-26 14-4 0-8-1-13-4l-9-8-5-11-52-217-42 97c-4 11-14 17-24 17H40c-11 0-20-8-20-19v-15c0-11 9-20 20-20h47l66-154c5-10 16-17 28-16" />
    </svg>
  );
}
export default SvgFeed;
