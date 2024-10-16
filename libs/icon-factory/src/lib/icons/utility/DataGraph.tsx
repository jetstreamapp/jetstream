import * as React from 'react';
function SvgDataGraph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M338 240a123 123 0 10-154 0l-15 26-32 56a91 91 0 1034 19l32-55 15-27a122 122 0 0087 0l15 27 30 54a91 91 0 1035-18l-31-55-16-27v-1zM111 461a52 52 0 100-104 52 52 0 000 104zm298 0a52 52 0 100-104 52 52 0 000 104z"
      />
    </svg>
  );
}
export default SvgDataGraph;
