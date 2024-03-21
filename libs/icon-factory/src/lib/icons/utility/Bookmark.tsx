import * as React from 'react';
function SvgBookmark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M37.3 49.6l-9.9-9.9c-.6-.6-1.5-.6-2.1 0l-10.6 10c-.7.6-1.7.2-1.7-.7V6c0-2.2 1.8-4 4-4h18c2.2 0 4 1.8 4 4v42.9c0 .9-1.1 1.4-1.7.7z"
      />
    </svg>
  );
}
export default SvgBookmark;
