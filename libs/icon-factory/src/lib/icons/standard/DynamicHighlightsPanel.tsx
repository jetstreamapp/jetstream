import * as React from 'react';
function SvgDynamicHighlightsPanel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M780 383H221c-11 0-21 9-21 19v316c0 29 25 52 55 52h490c30 0 55-23 55-52V402c0-10-10-20-21-20zm-30-163H250c-27 0-50 23-50 50v44c0 10 9 18 19 18h562c10 0 19-8 19-18v-44c0-27-23-50-50-50z" />
    </svg>
  );
}
export default SvgDynamicHighlightsPanel;
