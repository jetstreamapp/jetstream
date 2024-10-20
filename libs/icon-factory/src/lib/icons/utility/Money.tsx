import * as React from 'react';
function SvgMoney(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M301 261a60 60 0 0133-53 74 74 0 00-75-69 76 76 0 00-75 75c0 41 34 75 75 75 15 0 30-5 41-13v-15z" />
      <path d="M301 364v-19c0-7 1-13 3-19H128c0-29-23-53-53-53V161c29 0 53-23 53-53h263c0 29 23 53 53 53v40h38c7 0 13 1 19 3V97c0-25-20-45-45-45H65c-25 0-45 20-45 45v242c0 25 20 45 45 45h240c-2-6-4-13-4-20zm199 85c0 10-10 19-20 19H360a20 20 0 01-19-19v-19a20 20 0 0119-19h121c10 0 19 9 19 19v19z" />
      <path d="M500 365c0 10-10 19-20 19H360a20 20 0 01-19-19v-19a20 20 0 0119-19h121c10 0 19 9 19 19v19zm0-85c0 10-10 19-20 19H360a20 20 0 01-19-19v-19a20 20 0 0119-19h121c10 0 19 9 19 19v19z" />
    </svg>
  );
}
export default SvgMoney;
