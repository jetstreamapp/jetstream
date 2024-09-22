import * as React from 'react';
function SvgPrint(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M465 174H55a40 40 0 00-40 40v140a40 40 0 0040 40h59v58a40 40 0 0040 40h213a40 40 0 0040-40v-58h59a40 40 0 0040-40V214c-1-22-19-40-41-40zM83 277a30 30 0 01-30-30c0-17 13-30 30-30s30 13 30 30a30 30 0 01-30 30zm276 154c0 8-7 15-15 15H174c-8 0-15-7-15-15v-98c0-8 7-15 15-15h170c8 0 15 7 15 15v98zm46-320c0 8-7 15-15 15H128c-8 0-15-7-15-15V43c0-8 7-15 15-15h262c8 0 15 7 15 15v68z" />
    </svg>
  );
}
export default SvgPrint;
