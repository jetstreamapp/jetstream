import * as React from 'react';
function SvgSlackAddReaction(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <circle cx={173} cy={240} r={33} />
      <circle cx={293} cy={240} r={33} />
      <path d="M233 393c34 0 68-19 82-58 4-11-6-22-18-22H169c-12 0-22 11-18 22 13 39 48 58 82 58M480 93h-53V40c0-11-9-20-20-20s-20 9-20 20v53h-53c-11 0-20 9-20 20s9 20 20 20h53v53c0 11 9 20 20 20s20-9 20-20v-53h53c11 0 20-9 20-20s-9-20-20-20m-34 172c-1-11-11-19-22-18s-19 11-18 22v18a173 173 0 01-346 0c0-95 78-174 173-174h18c11 1 21-7 22-18s-7-21-18-22l-22-1C116 73 20 169 20 287a213 213 0 00426 0z" />
    </svg>
  );
}
export default SvgSlackAddReaction;
