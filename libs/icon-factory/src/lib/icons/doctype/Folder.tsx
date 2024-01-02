import * as React from 'react';
function SvgFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M51.48 15.46A4.52 4.52 0 0156 20v31a4.52 4.52 0 01-4.52 4.52h-47A4.52 4.52 0 010 51V13a4.52 4.52 0 014.52-4.48H16c3.82 0 4.23 1.14 6.74 4.45 2.07 2.74 7.11 2.49 10.39 2.49z"
        fill="#032D60"
      />
      <path d="M51.48 18.12H9.24a4.52 4.52 0 00-4.52 4.52v2.84L9.19 19h42.35L56 25.49v-2.85a4.52 4.52 0 00-4.52-4.52z" fill="#90D0FE" />
      <path
        d="M4.57 55.48h46.91A4.52 4.52 0 0056 51V23.48A4.52 4.52 0 0051.48 19H9.25a4.52 4.52 0 00-4.52 4.52V51a4.65 4.65 0 01-.06.72 2.33 2.33 0 01-4.6 0 4.5 4.5 0 004.5 3.76z"
        fill="#1AB9FF"
      />
    </svg>
  );
}
export default SvgFolder;
