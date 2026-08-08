import * as React from 'react';
function SvgHighlight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M423 29a32 32 0 00-43-2L186 182c-7 6-8 18-1 24l90 91c7 7 18 6 24-1l156-194a32 32 0 00-2-43zM160 216a17 17 0 00-23 0l-52 52c-7 7-7 17 0 24l4 4c8 8 11 13 8 20l-43 45c-9 9-5 24 8 27l44 12c11 2 22 0 30-7l18-15v1c7-5 12-3 20 2l7 7c6 7 17 7 23 0l52-53c6-6 6-17 0-23zm280 284c7 0 13-3 18-8l20-23c9-10 2-27-13-27H83c-7 0-13 2-18 7l-22 22c-11 11-3 29 12 29z" />
    </svg>
  );
}
export default SvgHighlight;
