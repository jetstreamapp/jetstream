import * as React from 'react';
function SvgColorSwatch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M35.4 9.5l7.1 7a4 4 0 010 5.7L24 40.7V15.3l5.8-5.8a4 4 0 015.6 0zM50 36v10a4 4 0 01-4 4H21l18-18h7a4 4 0 014 4zM2 41V6a4 4 0 014-4h10a4 4 0 014 4v35a9 9 0 01-18 0zm9 4a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}
export default SvgColorSwatch;
