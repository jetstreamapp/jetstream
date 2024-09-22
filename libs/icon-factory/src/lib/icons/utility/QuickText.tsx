import * as React from 'react';
function SvgQuickText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M261 33C125 33 15 134 15 258c0 39 11 76 30 109 3 5 4 11 2 17l-32 87c-3 8 5 15 13 13l88-34c5-2 11-1 17 2a260 260 0 00129 33c135-1 245-101 245-226S397 33 261 33zM147 250c0-5 4-10 10-10h159c5 0 10 4 10 10v20c0 5-4 10-10 10H156a10 10 0 01-10-10v-20zm229 96c0 5-4 10-10 10H156a10 10 0 01-10-10v-19c0-5 4-10 10-10h210c5 0 10 4 10 10v19zm0-153c0 5-4 10-10 10H156a10 10 0 01-10-10v-19c0-5 4-10 10-10h210c5 0 10 4 10 10v19z" />
    </svg>
  );
}
export default SvgQuickText;
