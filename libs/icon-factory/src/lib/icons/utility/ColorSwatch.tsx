import * as React from 'react';
function SvgColorSwatch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M35.435 9.494l7.071 7.071.002-.002a4 4 0 010 5.657l-.002.002L24 40.703V15.264l5.777-5.771h.001a4 4 0 015.656.002l.001-.001zM50 36v10a4 4 0 01-4 4H21l18-18h7a4 4 0 014 4zM2 41.046V6a4 4 0 014-4h10a4 4 0 014 4v35.046a9 9 0 01-18 0zM11 45a4 4 0 100-8 4 4 0 000 8z"
      />
    </svg>
  );
}
export default SvgColorSwatch;
