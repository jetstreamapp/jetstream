import * as React from 'react';
function SvgHttp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 20C128 20 20 128 20 260s108 240 240 240 240-108 240-240S392 20 260 20zm190 216h-63a353 353 0 00-34-144c53 30 90 82 97 144zM236 78v158h-55c4-75 28-134 55-158zm0 206v158c-27-24-51-83-55-158h55zm48 158V284h55c-4 75-28 134-55 158zm0-206V78c27 24 51 83 55 158h-55zM167 92a368 368 0 00-34 144H70c8-62 44-114 97-144zM70 284h63c2 57 15 106 34 144a190 190 0 01-97-144zm283 144c19-38 31-87 34-144h63a194 194 0 01-97 144z" />
    </svg>
  );
}
export default SvgHttp;
