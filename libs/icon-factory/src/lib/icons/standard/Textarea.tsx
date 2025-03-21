import * as React from 'react';
function SvgTextarea(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M740 800H260c-33 0-60-27-60-60V260c0-33 27-60 60-60h480c33 0 60 27 60 60v480c0 33-27 60-60 60zM281 300v400c0 11 9 20 20 20h399c11 0 20-9 20-20V300c0-11-9-20-20-20H301c-11 0-20 9-20 20zm338 212c10 0 20 9 20 20v87c0 11-9 20-20 20h-92c-11 0-20-9-20-20 0-7 3-13 8-18l19-19 40-36 28-25 8-6z" />
    </svg>
  );
}
export default SvgTextarea;
