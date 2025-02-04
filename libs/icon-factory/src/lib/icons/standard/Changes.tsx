import * as React from 'react';
function SvgChanges(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M28.75 42.06h15.88c.87 0 1.38.5 1.38 1.37v15.88c0 1 .87 2 2 2h4.12c1 0 2-.87 2-2V43.43c0-.87.5-1.37 1.37-1.37h15.88c1.12 0 2.12-.88 2-2v-4.12c0-1-.87-2-2-2H55.5c-.87 0-1.37-.5-1.37-1.38V16.68c0-1-.88-2-2-2h-4.12c-1 0-2 .87-2 2v15.88c0 .87-.5 1.38-1.38 1.38H28.75c-1 0-2 .87-2 2v4.12c0 1 .88 2 2 2zM71.39 71.96H28.75c-1 0-2 1-2 2v4.12c0 1.12 1 2.12 2 1.88h42.64c1 0 2-.88 2-2v-4.12c0-1-1-1.88-2-1.88z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgChanges;
