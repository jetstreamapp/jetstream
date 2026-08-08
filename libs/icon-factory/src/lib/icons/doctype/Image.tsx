import * as React from 'react';
function SvgImage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#06a59a" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#056764" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#acf3e4" />
      <path
        d="M10 54V33h21v21H10zm18.88-18.92H12.12v12.65h16.76V35.08zm-9.63 8.41l3.93-5.28 1.22 2.14 1.41-.44.98 5.65H13.65l3.51-3.33 2.1 1.27zm-3.87-3.65c-.91 0-1.66-.69-1.66-1.55s.74-1.55 1.66-1.55 1.66.69 1.66 1.55-.74 1.55-1.66 1.55z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgImage;
