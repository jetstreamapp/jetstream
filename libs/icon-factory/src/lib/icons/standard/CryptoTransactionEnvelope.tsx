import * as React from 'react';
function SvgCryptoTransactionEnvelope(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M533 209c21-12 46-12 67 0l144 83c21 12 34 34 34 58v167c0 24-13 46-34 58l-144 83a66 66 0 01-67 0l-144-83a66 66 0 01-34-58V350c0-24 13-46 34-58l144-83zm4 230l-55 56-5 2-5-2-55-56c-4-4-1-10 6-10h33a107 107 0 01110-109v41c-35 0-68 34-68 68h32c7 0 11 5 6 10zm173-1h-34a108 108 0 01-111 109v-41c42 0 70-27 70-68h-33c-7 0-10-5-6-9l55-57 5-1 4 1 56 57c4 3 1 9-6 9z"
      />
      <path d="M256 425l42-24v149c0 24 13 46 33 58l202 117c11 6 22 9 33 9l-99 57a66 66 0 01-67 0l-144-83a66 66 0 01-34-58V483c0-24 13-46 34-58z" />
    </svg>
  );
}
export default SvgCryptoTransactionEnvelope;
