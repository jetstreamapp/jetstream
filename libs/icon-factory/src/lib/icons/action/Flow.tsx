import * as React from 'react';
function SvgFlow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M499 106c-21-41-74-117-172-72l-95 44-88 38c-25 12-79-5-110-16-9-3-17 6-13 15 21 41 74 117 172 72l183-81c25-12 79 5 110 16 9 2 17-7 13-16zM288 234l-55 26-44 19c-22 12-69-4-97-15-8-4-15 6-11 14 18 40 65 112 151 68 54-27 99-45 99-45 22-12 69 4 97 15 8 3 15-6 11-15-18-39-65-111-151-67zm-32 177l-24 14c-17 11-52-3-73-13-6-3-11 6-8 14 13 36 48 101 113 61l24-14c18-9 52 3 73 13 6 3 11-6 8-14-13-36-46-98-113-61z" />
    </svg>
  );
}
export default SvgFlow;
