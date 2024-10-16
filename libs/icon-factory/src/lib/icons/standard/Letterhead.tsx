import * as React from 'react';
function SvgLetterhead(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M738 200H262c-34 0-62 28-62 62v476c0 34 28 62 62 62h476c34 0 62-28 62-62V262c0-34-28-62-62-62zm-28 491c0 8-8 14-16 14H305c-8 0-14-8-14-16v-90c0-8 8-14 16-14h389c8 0 14 8 14 16zm0-292c0 8-8 14-16 14H305c-8 0-14-8-14-16v-90c0-8 8-14 16-14h389c8 0 14 8 14 16z" />
    </svg>
  );
}
export default SvgLetterhead;
