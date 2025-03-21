import * as React from 'react';
function SvgSnippet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M741 239c-121 0-213 94-213 214v288c0 11 9 20 20 20h228c11 0 20-9 20-20V513c0-11-9-20-20-20H608v-40c0-67 66-134 133-134h35c11 0 20-9 20-20v-40c0-11-9-20-20-20zm-333 0c-121 0-213 94-213 214v288c0 11 9 20 20 20h228c11 0 20-9 20-20V513c0-11-9-20-20-20H276v-40c0-67 66-134 133-134h35c11 0 20-9 20-20v-40c0-11-9-20-20-20z" />
    </svg>
  );
}
export default SvgSnippet;
