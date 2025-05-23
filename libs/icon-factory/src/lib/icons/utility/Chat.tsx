import * as React from 'react';
function SvgChat(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 40C127 40 21 138 21 259c0 38 11 74 29 106 3 5 4 11 2 17l-31 85c-3 8 5 15 13 13l86-33c5-2 11-1 17 2 36 20 79 32 125 32 131-1 238-98 238-220-1-123-108-221-240-221zM140 300c-22 0-40-18-40-40s18-40 40-40 40 18 40 40-18 40-40 40zm120 0c-22 0-40-18-40-40s18-40 40-40 40 18 40 40-18 40-40 40zm120 0c-22 0-40-18-40-40s18-40 40-40 40 18 40 40-18 40-40 40z" />
    </svg>
  );
}
export default SvgChat;
