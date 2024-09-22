import * as React from 'react';
function SvgRecipe(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M565 228a28 28 0 11-28-28 28 28 0 0128 28zM462 332a38 38 0 10-37-38 38 38 0 0037 38zm243 388L580 527V425a27 27 0 0030-24 23 23 0 000-4 25 25 0 00-22-27H415a25 25 0 00-25 25v3a27 27 0 0026 28 32 32 0 004 0v104L295 720a53 53 0 00-3 53 49 49 0 0044 27h327a49 49 0 0044-27 50 50 0 00-2-53zM470 544V430h60v116l59 94H411z" />
    </svg>
  );
}
export default SvgRecipe;
