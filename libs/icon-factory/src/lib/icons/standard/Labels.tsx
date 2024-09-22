import * as React from 'react';
function SvgLabels(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M69.87 50.44L58.21 38.76a4.239 4.239 0 00-3.06-1.41l-30.28-.24c-2.58.06-4.67 2.14-4.76 4.72l-.09 23.68a4.89 4.89 0 004.72 4.75l29.87.19c1.1.07 2.16-.32 2.93-1.11L69.77 57.2a4.998 4.998 0 00.1-6.76z"
        fill="unset"
        fillRule="evenodd"
      />
      <path
        d="M74.97 53.52c1.84-1.9 1.89-4.9.1-6.84l-11.66-11.9c-.77-.89-1.89-1.4-3.06-1.41l-30.33-.19c-.34 0-.67.05-1.01.12a5 5 0 014.63-3.75l30.29.2c1.17.01 2.27.54 3.05 1.41l11.74 11.9a4.977 4.977 0 01-.1 6.84"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgLabels;
