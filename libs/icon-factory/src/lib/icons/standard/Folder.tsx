import * as React from 'react';
function SvgFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M750 347H466c-18 0-34-10-44-25l-44-76c-8-16-24-26-43-26h-85c-28 0-50 23-50 51v458c0 28 22 51 50 51h500c28 0 50-23 50-51V398c0-28-22-51-50-51zm0-102H449c-5 0-8 5-5 9l20 34c2 5 6 8 11 8h275c14 0 28 3 39 8 5 3 11-1 11-8 0-28-22-51-50-51z" />
    </svg>
  );
}
export default SvgFolder;
