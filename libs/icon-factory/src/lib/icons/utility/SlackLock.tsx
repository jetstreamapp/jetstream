import * as React from 'react';
function SvgSlackLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M260 20c-72 0-131 59-131 131v44h-7c-36 0-65 29-65 65v189c0 28 23 51 51 51h305c28 0 51-23 51-51V260c0-36-29-65-65-65h-7v-44c0-72-59-131-131-131zm87 175v-44a87 87 0 00-174 0v44h175zm-247 65c0-12 10-22 22-22h276c12 0 22 10 22 22v189c0 4-3 7-7 7H107c-4 0-7-3-7-7z"
      />
    </svg>
  );
}
export default SvgSlackLock;
