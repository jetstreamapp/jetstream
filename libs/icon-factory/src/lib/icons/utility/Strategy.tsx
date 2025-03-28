import * as React from 'react';
function SvgStrategy(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M469 187h-81a32 32 0 00-32 32v20h-75V81c0-5-5-10-10-10H166V52c0-18-14-32-32-32H53a32 32 0 00-32 32v81c0 18 14 32 32 32h81c18 0 32-14 32-32v-19h74v125h-74v-19c0-18-14-32-32-32H53a32 32 0 00-32 32v80c0 18 14 32 32 32h81c18 0 32-14 32-32v-19h74v125h-74v-18c0-18-14-32-32-32H53a32 32 0 00-32 32v81c0 18 14 32 32 32h81c18 0 32-14 32-32v-19h106c6 0 10-6 10-10V282h75v18c0 18 14 32 32 32h81c18 0 32-14 32-32v-81a33 33 0 00-33-32zm-344-63H62V60h63v64zm0 104v63H62v-63h63zm0 232H62v-63h63v63zm336-232v63h-63v-63h63z" />
    </svg>
  );
}
export default SvgStrategy;
