import * as React from 'react';
function SvgReminder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M50.3 7.5a7.45 7.45 0 00-6.2-5.9 7.81 7.81 0 00-5.8 1.6.81.81 0 00.2 1.4 28.48 28.48 0 019.4 8.2.84.84 0 001.4 0 6.87 6.87 0 001-5.3zM13.5 4.7a.9.9 0 00.2-1.4 7 7 0 00-5.8-1.6 7.23 7.23 0 00-6.2 5.8 7.36 7.36 0 001.1 5.3.84.84 0 001.4 0 26 26 0 019.3-8.1zM26 6.5a22.06 22.06 0 00-22 22 21.58 21.58 0 004.3 13L5 44.8a3.2 3.2 0 000 4.6 3.15 3.15 0 004.6 0l3.3-3.3A22.1 22.1 0 0026 50.4a21.58 21.58 0 0013-4.3l3.3 3.3a3.25 3.25 0 002.4 1 3.3 3.3 0 002.3-5.6l-3.3-3.3a21.58 21.58 0 004.3-13 21.94 21.94 0 00-22-22zM10.5 28.4A15.5 15.5 0 1126 43.9a15.49 15.49 0 01-15.5-15.5zm18-.9v-6.4a2.37 2.37 0 00-2.4-2.4 2.43 2.43 0 00-2.4 2.4v7.3a2.06 2.06 0 00.7 1.7l5.7 5.7a2.41 2.41 0 003.4 0 2.3 2.3 0 000-3.4z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgReminder;
