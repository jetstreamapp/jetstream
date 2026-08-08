import * as React from 'react';
function SvgWebex(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#3ba755" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#22683e" />
      <path
        d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6zM20.52 54c2.56-.14 4.96-1.26 6.72-3.12a10.007 10.007 0 000-13.76A10.002 10.002 0 0020.52 34v20z"
        fill="#cdefc4"
      />
      <path
        d="M19.38 54c-2.54-.16-4.92-1.29-6.66-3.14-1.74-1.86-2.71-4.31-2.71-6.85s.97-5 2.71-6.85a9.97 9.97 0 016.66-3.14v19.99z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgWebex;
