import * as React from 'react';
function SvgLibraryFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 640" aria-hidden="true" {...props}>
      <path
        fill="#032d60"
        d="M515 155c25 0 45 20 45 45v310c0 25-20 45-45 45H45a45 45 0 01-45-45V130c0-25 20-45 45-45h115c38 0 42 12 67 45 21 27 72 25 104 25h184z"
      />
      <path fill="#90d0fe" d="M515 181H92a45 45 0 00-45 45v29l45-65h423l45 65v-29c0-25-20-45-45-45z" />
      <path
        fill="#1ab9ff"
        d="M46 555h469c25 0 45-20 45-45V235c0-25-20-45-45-45H93a45 45 0 00-46 44v283c0 13-10 23-23 23a23 23 0 01-23-23 45 45 0 0045 38z"
      />
      <path
        fill="unset"
        d="M255 378h36v115h-36zm61 0h36v115h-36zm148-60l-150-62c-4-2-7-3-11-3-1 0-5 0-11 3l-150 62c-3 2-5 5-5 8v9c0 5 4 9 9 9h29v140c0 5 4 9 9 9h45V378h-18c-4 0-6-2-6-6v-12c0-4 2-6 6-6h183c4 0 6 2 6 6v12c0 4-2 6-6 6h-18v115h45c5 0 9-4 9-9V344h29c5 0 9-4 9-9v-8c1-4-1-7-4-9zm-161 5a19 19 0 110-38 19 19 0 010 38z"
      />
    </svg>
  );
}
export default SvgLibraryFolder;
