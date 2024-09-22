import * as React from 'react';
function SvgKanban(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M565 383c0-10-9-19-19-19H434c-10 0-19 9-19 19v337c0 10 9 19 19 19h112c10 0 19-9 19-19zm-225 0c0-10-9-19-19-19H209c-10 0-19 9-19 19v387c0 10 9 19 19 19h112c10 0 19-9 19-19zm450 0c0-10-9-19-19-19H659c-10 0-19 9-19 19v287c0 10 9 19 19 19h112c10 0 19-9 19-19zm0-175c0-10-9-19-19-19H209c-10 0-19 9-19 19v62c0 10 9 19 19 19h562c10 0 19-9 19-19z" />
    </svg>
  );
}
export default SvgKanban;
