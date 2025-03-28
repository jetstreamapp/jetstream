import * as React from 'react';
function SvgYubiKey(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M385 141H15c-8 0-15 7-15 15v210c0 8 7 15 15 15h370c8 0 15-7 15-15V156c0-8-7-15-15-15zM210 322c-34 0-61-27-61-61s27-61 61-61 61 27 61 61-27 61-61 61z" />
      <path d="M505 180H360c-8 0-15 7-15 15v130c0 8 7 15 15 15h145c8 0 15-7 15-15V195c0-8-7-15-15-15zm-34 40c6 0 10 4 10 10v19h-81v-29h71zm0 80h-71v-27h81v17c0 6-4 10-10 10z" />
      <circle cx={210} cy={261} r={12} />
    </svg>
  );
}
export default SvgYubiKey;
