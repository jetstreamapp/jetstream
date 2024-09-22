import * as React from 'react';
function SvgForm(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M364 148h85a11 11 0 0011-11 10 10 0 00-3-8L351 23a10 10 0 00-8-3 11 11 0 00-11 11v85a32 32 0 0032 32zm80 48H332a48 48 0 01-48-48V36a16 16 0 00-16-16H108a48 48 0 00-48 48v384a48 48 0 0048 48h304a48 48 0 0048-48V212a16 16 0 00-16-16zm-320-16a16 16 0 0116-15h66a16 16 0 0115 15v16a16 16 0 01-16 16h-65a16 16 0 01-16-16zm240 208a16 16 0 01-16 16H140a16 16 0 01-16-16v-16a16 16 0 0116-16h208a16 16 0 0116 16zm32-96a16 16 0 01-16 16H140a16 16 0 01-16-16v-16a16 16 0 0116-16h240a16 16 0 0116 16z" />
    </svg>
  );
}
export default SvgForm;
