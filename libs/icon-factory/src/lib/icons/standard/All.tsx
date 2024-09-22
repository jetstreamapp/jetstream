import * as React from 'react';
function SvgAll(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M570 445c-15 0-27-12-27-27V245c0-15 12-27 27-27h176c15 0 27 12 27 27v173c0 15-12 27-27 27H570zm76 102L543 658c-6 6-6 17 0 23l103 111c7 7 18 7 25 0l103-111c6-6 6-17 0-23L671 547c-7-7-19-7-25 0zM236 257l89-51c8-5 18-5 27 0l89 51c8 5 13 14 13 23v102c0 9-5 18-13 23l-89 51c-8 5-18 5-27 0l-89-51c-8-5-14-14-14-23V280c0-10 6-19 14-23z" />
      <circle cx={338} cy={666} r={116} />
    </svg>
  );
}
export default SvgAll;
