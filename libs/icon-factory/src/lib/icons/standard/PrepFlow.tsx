import * as React from 'react';
function SvgPrepFlow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M32.6 43.25A9 9 0 1129 26c4.28 0 7.87 2.99 8.78 7H50v-3c0-2.21 1.79-4 4-4h22c2.21 0 4 1.79 4 4v10c0 2.21-1.79 4-4 4H54c-2.21 0-4-1.79-4-4v-1H37.13c2.22 3.97 2.84 6.97 3.61 10.69.2.98.42 2.02.68 3.13l.03.15c.35 1.54.89 3.88 2.31 5.9 1.17 1.66 2.99 3.19 6.23 3.55V60c0-2.21 1.79-4 4-4h22c2.21 0 4 1.79 4 4v10c0 2.21-1.79 4-4 4h-22c-2.21 0-4-1.79-4-4v-1.56c-5.44-.41-8.96-3.02-11.14-6.12-2.12-3.01-2.88-6.37-3.23-7.9-.02-.09-.04-.17-.06-.25-.3-1.31-.54-2.45-.76-3.48-.62-2.98-1.05-5.02-2.22-7.45z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgPrepFlow;
