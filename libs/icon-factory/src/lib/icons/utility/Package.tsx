import * as React from 'react';
function SvgPackage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44.4 24h-7.9l-3.3 4H44v6H8v-6h10.7l-3.3-4H7.6c-2 0-3.6 1.6-3.6 3.6V47c0 1.7 1.3 3 3 3h38c1.7 0 3-1.3 3-3V27.6c0-2-1.6-3.6-3.6-3.6z"
      />
      <path
        fill="unset"
        d="M23 3.5V16h-6.9c-1 0-1.5.9-.9 1.4l10 12.3c.4.3 1 .3 1.4 0l10-12.3c.6-.6.1-1.4-.9-1.4H29V3.5c0-.8-.7-1.5-1.5-1.5h-3c-.8 0-1.5.7-1.5 1.5z"
      />
    </svg>
  );
}
export default SvgPackage;
