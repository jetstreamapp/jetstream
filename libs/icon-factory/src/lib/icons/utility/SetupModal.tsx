import * as React from 'react';
function SvgSetupModal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M485 20H35c-8 0-15 7-15 15v324c0 8 7 15 15 15h450c8 0 15-7 15-15V35c0-8-7-15-15-15zM320 440c11 0 20 9 20 20s-9 20-20 20-20-9-20-20 9-20 20-20m0-20c-22 0-40 18-40 40s18 40 40 40 40-18 40-40-18-40-40-40z" />
      <circle cx={200} cy={460} r={40} />
      <circle cx={80} cy={460} r={40} />
      <circle cx={440} cy={460} r={40} />
    </svg>
  );
}
export default SvgSetupModal;
