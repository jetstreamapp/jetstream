import * as React from 'react';
function SvgCryptoWallet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M532 210a64 64 0 00-64 0l-66 38a64 64 0 00-32 55v76c0 23 12 44 32 56l66 38c20 11 44 11 64 0l66-38c20-12 32-33 32-56v-76c0-23-12-44-32-55zM264 392h69v8c0 23 12 44 32 56h-69a32 32 0 100 64h440c35 0 64 29 64 65v150c0 35-29 64-64 64H264c-35 0-64-29-64-64V456c0-35 29-64 64-64zm472 64H632h1c21-12 34-33 34-57v-7h4c36 0 65 29 65 64z" />
    </svg>
  );
}
export default SvgCryptoWallet;
