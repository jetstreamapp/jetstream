import * as React from 'react';
function SvgWorkStepTemplate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M285 685V345h-16a49 49 0 00-48 49v354a49 49 0 0048 49h356a49 49 0 0048-49v-14H333a49 49 0 01-48-49zm179-383h177a16 16 0 0016-16v-33a49 49 0 00-48-49H496a48 48 0 00-48 49v33a16 16 0 0016 16zm266-58h-16a7 7 0 00-8 8v33a66 66 0 01-65 66H464a66 66 0 01-65-66v-33a7 7 0 00-8-8h-16a48 48 0 00-48 49v353a49 49 0 0048 49h355a48 48 0 0048-49V294a49 49 0 00-48-50zM609 555a16 16 0 01-16 16H431a16 16 0 01-16-16v-16a16 16 0 0116-16h162a16 16 0 0116 16zm81-82a16 16 0 01-16 16H431a16 16 0 01-16-16v-16a16 16 0 0116-16h243a16 16 0 0116 16z" />
    </svg>
  );
}
export default SvgWorkStepTemplate;
