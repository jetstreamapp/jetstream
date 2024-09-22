import * as React from 'react';
function SvgCase(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M380 290h40c6 0 10-4 10-10v-30h140v30c0 6 4 10 10 10h40c6 0 10-4 10-10v-30c0-33-27-60-60-60H430c-33 0-60 27-60 60v30c0 6 4 10 10 10zm360 60H260c-33 0-60 27-60 60v320c0 33 27 60 60 60h480c33 0 60-27 60-60V410c0-33-27-60-60-60z" />
    </svg>
  );
}
export default SvgCase;
