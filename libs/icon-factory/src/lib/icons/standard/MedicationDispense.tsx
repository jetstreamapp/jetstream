import * as React from 'react';
function SvgMedicationDispense(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M582 200H314a13 13 0 00-14 13l1 37a14 14 0 0013 13h268a14 14 0 0013-13v-37a13 13 0 00-13-13zm36 328V387a91 91 0 00-90-92H370a91 91 0 00-92 90v26h167a15 15 0 0115 15v168a15 15 0 01-15 15H278v74a14 14 0 0015 13h184a141 141 0 01141-141zm0 64a104 104 0 10104 104 104 104 0 00-104-104zm50 127l-46 45a6 6 0 01-9 0l-45-45a5 5 0 010-8l8-8a6 6 0 018 0l15 14a4 4 0 006-3l1-82a7 7 0 016-6h12a6 6 0 016 6v82a4 4 0 007 3l14-14a6 6 0 019 0l8 8a6 6 0 010 8z" />
      <rect width={132} height={30} x={278} y={456} rx={10} />
      <rect width={92} height={30} x={278} y={531} rx={10} />
    </svg>
  );
}
export default SvgMedicationDispense;
