import * as React from 'react';
function SvgBan(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M26 2C12.8 2 2 12.8 2 26s10.8 24 24 24 24-10.8 24-24S39.2 2 26 2zm11.9 25.7c-.1.7-.7 1.3-1.5 1.3H15.6c-.8 0-1.4-.5-1.5-1.3-.1-1.2-.1-2.3 0-3.4.1-.7.7-1.3 1.5-1.3h20.8c.8 0 1.4.6 1.5 1.3.1 1.2.1 2.3 0 3.4z"
      />
    </svg>
  );
}
export default SvgBan;
