import * as React from 'react';
function SvgPortal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M720 220H280c-33 0-60 27-60 60v440c0 33 27 60 60 60h440c33 0 60-27 60-60V280c0-33-27-60-60-60zM590 626c3 12-7 24-19 24H430c-13 0-22-12-19-24l32-110c-31-22-49-61-41-104 8-40 39-72 79-79a99 99 0 01119 99c0 35-17 65-43 83z" />
    </svg>
  );
}
export default SvgPortal;
