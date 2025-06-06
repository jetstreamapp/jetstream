import * as React from 'react';
function SvgToggle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M392 20H124C66 22 20 69 20 128s46 106 104 108h268c59 0 108-48 108-108S452 20 392 20zM127 188c-33 0-60-27-60-60s27-60 60-60 60 27 60 60-27 60-60 60zm265 97H124c-58 2-104 49-104 107s46 106 104 108h268c60 0 108-48 108-108s-48-107-108-107zm4 184H123c-40-2-72-35-72-76s32-74 72-76h273c40 2 72 35 72 76s-32 74-72 76z" />
      <circle cx={392} cy={392} r={52} />
    </svg>
  );
}
export default SvgToggle;
