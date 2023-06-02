import * as React from 'react';
function SvgLabel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M48.79 29.14l-10.93 11c-.73.81-1.77 1.29-2.86 1.31l-28.45.18c-2.43-.05-4.4-2-4.47-4.43L2 15a4.583 4.583 0 014.47-4.44l28-.17c1.02-.09 2.03.28 2.75 1l11.48 11.4a4.64 4.64 0 01.09 6.35z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgLabel;
