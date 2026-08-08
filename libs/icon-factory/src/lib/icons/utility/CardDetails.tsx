import * as React from 'react';
function SvgCardDetails(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M452 86H68c-26 0-48 22-48 48v272c0 26 22 48 48 48h384c26 0 48-22 48-48V134c0-26-22-48-48-48m0 48v48H68v-48zM68 406V262h384v144zm137-104a31 31 0 00-27 14c0 2-3 2-4 0a31 31 0 00-26-14 32 32 0 00-32 32 32 32 0 0032 32 31 31 0 0026-14c1-2 4-2 4 0a31 31 0 0027 14h1c16 0 31-14 31-31v-2c-1-17-15-31-32-31m183 8h-96c-9 0-16 7-16 16v16c0 9 7 16 16 16h96c9 0 16-7 16-16v-16c0-9-7-16-16-16" />
    </svg>
  );
}
export default SvgCardDetails;
