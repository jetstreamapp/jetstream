import * as React from 'react';
function SvgScanCard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M74 30H26c-3.3 0-6 2.7-6 6v28c0 3.3 2.7 6 6 6h48c3.3 0 6-2.7 6-6V36c0-3.3-2.7-6-6-6zM25 53c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm47 9c0 1.1-.9 2-2 2H32c-1.1 0-2-.9-2-2V38c0-1.1.9-2 2-2h38c1.1 0 2 .9 2 2v24z"
      />
      <path fill="unset" d="M64 42H38c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h26c1.1 0 2-.9 2-2V44c0-1.1-.9-2-2-2z" />
    </svg>
  );
}
export default SvgScanCard;
