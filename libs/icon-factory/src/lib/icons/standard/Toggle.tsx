import * as React from 'react';
function SvgToggle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M200 333.4a134.3 134.3 0 01130-134.3h335.6a134.5 134.5 0 010 268.9H330a134.4 134.4 0 01-130-134.6zm134.4 75.3a75.3 75.3 0 10-75.2-75.3 75.8 75.8 0 0075.2 75.3zM200 664.6A134.4 134.4 0 01330 530h335.6a134.5 134.5 0 010 268.9H330a134.3 134.3 0 01-130-134.3zM670.6 570H329.4a95.3 95.3 0 000 190h341.2a95.3 95.3 0 000-190zm-5 160a65.3 65.3 0 1165.2-65.2 65.8 65.8 0 01-65.2 65.2z" />
    </svg>
  );
}
export default SvgToggle;
