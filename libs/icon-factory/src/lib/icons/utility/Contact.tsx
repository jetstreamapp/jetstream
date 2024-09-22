import * as React from 'react';
function SvgContact(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M452 91H68a48 48 0 00-48 48v232c0 26 22 48 48 48h384c26 0 48-22 48-48V139c0-26-22-48-48-48zM249 363H110c-15 0-27-17-27-33 0-24 26-38 52-50 18-8 20-15 20-23s-4-16-10-21a54 54 0 01-17-40c0-30 18-56 50-56s50 25 50 56c0 16-5 30-16 40-7 5-11 13-11 20s2 16 20 23c27 11 52 27 52 51 2 16-10 33-25 33zm187-56c0 9-7 16-16 16h-72a16 16 0 01-16-16v-24c0-9 7-16 16-16h72c9 0 16 7 16 16v24zm0-88c0 9-7 16-16 16H300a16 16 0 01-16-16v-24c0-9 7-16 16-16h120c9 0 16 7 16 16v24z" />
    </svg>
  );
}
export default SvgContact;
