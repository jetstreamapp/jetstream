import * as React from 'react';
function SvgPeople(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M420 223c-28-11-32-22-32-33s8-22 18-30a74 74 0 0026-58c0-44-29-82-80-82a76 76 0 00-79 71c0 4 2 7 5 9 38 24 61 66 61 117 0 38-15 72-42 96-2 2-2 6 0 8 7 5 23 12 33 17l8 2h121c23 0 41-19 41-40v-6c0-35-38-54-80-71zM286 362c-34-14-39-26-39-39s10-26 21-36c20-17 31-41 31-69 0-52-34-97-96-97-61 0-96 45-96 97 0 28 11 52 31 69 11 10 21 23 21 36s-5 26-40 39c-50 20-99 43-99 85v13a40 40 0 0041 40h277c23 0 42-18 42-40v-14c0-41-44-64-94-84z" />
    </svg>
  );
}
export default SvgPeople;
