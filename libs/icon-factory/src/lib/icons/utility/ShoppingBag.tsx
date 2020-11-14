import * as React from 'react';

function SvgShoppingBag(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path d="M64.7 19.1v.4-.4z" />
      <path
        fill="unset"
        d="M44 19.6c0-2.2-1.8-4-4-4h-.7c-.5-6.8-6.2-12.2-13.2-12.2S13.5 8.8 12.9 15.6H12c-2.2 0-4 1.8-4 4l-2 25c0 2.2 1.8 4 4 4h32c2.2 0 4-1.8 4-4l-2-25zM26.1 9.4c3.7 0 6.7 2.7 7.2 6.2H18.9c.6-3.5 3.6-6.2 7.2-6.2zm5.7 18.2H20.2c-1.7 0-3-1.4-3-3s1.4-3 3-3h11.7c1.7 0 3 1.4 3 3s-1.4 3-3.1 3z"
      />
    </svg>
  );
}

export default SvgShoppingBag;
