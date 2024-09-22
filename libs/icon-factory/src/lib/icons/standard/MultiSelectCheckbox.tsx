import * as React from 'react';
function SvgMultiSelectCheckbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M730 200H410c-33 0-60 27-60 60v10c0 6 4 10 10 10h290c33 0 60 27 60 60v310c0 6 4 10 10 10h10c33 0 60-27 60-60V260c0-33-27-60-60-60zM590 340H270c-33 0-60 27-60 60v340c0 33 27 60 60 60h320c33 0 60-27 60-60V400c0-33-27-60-60-60zm-27 170L410 663a29 29 0 01-42 0l-74-74c-6-6-6-15 0-21l21-21c6-6 15-6 21 0l53 53 132-132c6-6 15-6 21 0l21 21c5 6 5 16 0 21z" />
    </svg>
  );
}
export default SvgMultiSelectCheckbox;
