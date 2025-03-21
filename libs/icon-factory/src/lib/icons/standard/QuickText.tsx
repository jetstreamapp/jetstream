import * as React from 'react';
function SvgQuickText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M495 215c-167 0-299 123-299 274 0 48 14 93 36 133 4 6 5 14 3 21l-39 107c-4 10 6 19 16 16l108-41c6-3 14-1 21 3 45 25 99 40 157 40 164-1 298-123 298-276-1-154-135-277-301-277zM356 480c0-6 5-12 12-12h194c6 0 12 5 12 12v23c0 6-5 12-12 12H367c-6 0-12-5-12-12v-23zm279 116c0 6-5 12-12 12H367c-6 0-12-5-12-12v-23c0-6 5-12 12-12h256c6 0 12 5 12 12zm0-186c0 6-5 12-12 12H367c-6 0-12-5-12-12v-23c0-6 5-12 12-12h256c6 0 12 5 12 12z" />
    </svg>
  );
}
export default SvgQuickText;
