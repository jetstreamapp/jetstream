import * as React from 'react';
function SvgLabels(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" fillRule="evenodd" aria-hidden="true" {...props}>
      <path d="M69.87 50.44L58.21 38.76a4.24 4.24 0 00-3.06-1.41l-30.28-.24a4.9 4.9 0 00-4.76 4.72l-.09 23.68a4.89 4.89 0 004.72 4.75l29.87.19c1.1.07 2.16-.32 2.93-1.11L69.77 57.2a5 5 0 00.1-6.76m5.1 3.08a4.98 4.98 0 00.1-6.84l-11.66-11.9a4.1 4.1 0 00-3.06-1.41l-30.33-.19c-.34 0-.67.05-1.01.12a5 5 0 014.63-3.75l30.29.2c1.17.01 2.27.54 3.05 1.41l11.74 11.9a4.98 4.98 0 01-.1 6.84" />
    </svg>
  );
}
export default SvgLabels;
