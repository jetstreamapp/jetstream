import * as React from 'react';
function SvgCryptoTransactionEnvelopeItem(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M532 209a64 64 0 00-64 0L264 326a64 64 0 00-33 56v236c0 23 13 44 33 55l204 118c20 12 44 12 64 0l204-118c20-11 32-32 32-55V382c0-23-12-44-32-55zM392 578l70-72c5-5 1-12-8-12h-41c0-43 42-86 86-86v-52a136 136 0 00-139 138h-42c-9 0-13 8-8 12l70 72 6 2zm247-72h43c9 0 13-8 8-12l-71-72-6-2-6 2-70 72c-5 5-1 12 8 12h42c0 52-36 86-88 86v52a139 139 0 00130-85c7-17 10-35 10-53z"
      />
    </svg>
  );
}
export default SvgCryptoTransactionEnvelopeItem;
