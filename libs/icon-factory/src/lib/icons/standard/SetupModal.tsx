import * as React from 'react';
function SvgSetupModal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M781 200H219c-10 0-19 9-19 19v405c0 10 9 19 19 19h562c10 0 19-9 19-19V219c0-10-9-19-19-19zM575 725c14 0 25 11 25 25a25 25 0 11-25-25m0-25c-27 0-50 23-50 50s23 50 50 50 50-22 50-50-22-50-50-50z" />
      <circle cx={425} cy={750} r={50} />
      <circle cx={275} cy={750} r={50} />
      <circle cx={725} cy={750} r={50} />
    </svg>
  );
}
export default SvgSetupModal;
