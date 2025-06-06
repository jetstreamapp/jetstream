import * as React from 'react';
function SvgThanks(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M740 350h-87c25-39 23-91-8-123a91 91 0 00-64-27 100 100 0 00-81 45l-10-13a96 96 0 00-71-32c-24 0-46 10-63 27-31 32-33 84-8 123h-88c-33 0-60 27-60 60v40c0 11 9 20 20 20h560c11 0 20-9 20-20v-40c0-33-27-60-60-60zm-270 0c-21 0-51-8-68-26-15-16-17-42-3-55 7-7 14-8 20-8 10 0 20 5 27 13 17 19 24 51 24 71v5zm128-26c-17 18-47 26-68 26v-6c0-20 7-52 24-71 8-8 18-13 27-13 5 0 13 1 20 8 13 14 12 39-3 56zm142 206H530v270h172c32 0 58-26 58-58V550c0-11-9-20-20-20zm-500 20v190c0 33 27 60 60 60h170V530H260c-11 0-20 9-20 20z" />
    </svg>
  );
}
export default SvgThanks;
