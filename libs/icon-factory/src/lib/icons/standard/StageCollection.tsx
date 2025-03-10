import * as React from 'react';
function SvgStageCollection(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M759 458c-15 0-29 8-36 21h-45c-11-90-87-159-179-159s-168 69-179 158h-43c-7-12-21-21-36-21-23 0-42 19-42 42s19 42 42 42c15 0 28-8 36-19h44c11 89 87 158 178 158s167-69 178-157h45c8 12 21 19 36 19 23 0 42-19 42-42s-18-42-41-42zM499 620c-66 0-120-54-120-120s54-120 120-120 120 54 120 120-54 120-120 120z" />
      <circle cx={498} cy={500} r={42} />
    </svg>
  );
}
export default SvgStageCollection;
