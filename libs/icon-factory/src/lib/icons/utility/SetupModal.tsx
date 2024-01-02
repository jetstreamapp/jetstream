import * as React from 'react';
function SvgSetupModal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path fill="unset" d="M48.5 2h-45C2.7 2 2 2.7 2 3.5v32.4c0 .8.7 1.5 1.5 1.5h45c.8 0 1.5-.7 1.5-1.5V3.5c0-.8-.7-1.5-1.5-1.5z" />
      <circle fill="unset" cx={20} cy={46} r={4} />
      <circle fill="unset" cx={8} cy={46} r={4} />
      <path fill="unset" d="M32 44c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0-2c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4z" />
      <circle fill="unset" cx={44} cy={46} r={4} />
    </svg>
  );
}
export default SvgSetupModal;
