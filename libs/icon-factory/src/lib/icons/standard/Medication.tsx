import * as React from 'react';
function SvgMedication(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M307 262h266a13 13 0 0013-13v-36a13 13 0 00-13-13H307a13 13 0 00-13 13v37a13 13 0 0013 12zm302 263V385a91 91 0 00-90-91H363a91 91 0 00-92 90v25h166a15 15 0 0115 15v167a15 15 0 01-15 15H271v73a14 14 0 0015 13h182l140-166zm103 26a63 63 0 00-89 7l-48 57 97 81 47-56a63 63 0 00-7-89zM507 696a63 63 0 0096 82l48-57-97-81z" />
      <rect x={272} y={453} width={131} height={30} rx={10} />
      <rect x={272} y={528} width={92} height={30} rx={10} />
    </svg>
  );
}
export default SvgMedication;
