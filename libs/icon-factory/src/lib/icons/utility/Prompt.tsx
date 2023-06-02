import * as React from 'react';
function SvgPrompt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="unset"
        d="M47 4.5H5c-1.7 0-3 1.3-3 3v30.6c0 1.7 1.3 3 3 3h14.5l3.6 5.2c1 1.4 2.8 1.7 4.2.7l.6-.6 4.2-5.3H47c1.7 0 3-1.3 3-3V7.5c0-1.7-1.3-3-3-3z"
      />
    </svg>
  );
}
export default SvgPrompt;
