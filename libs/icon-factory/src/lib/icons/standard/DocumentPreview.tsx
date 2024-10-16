import * as React from 'react';
function SvgDocumentPreview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M390 320h220c11 0 20-9 20-20v-40c0-32-27-60-60-60H430c-32 0-60 28-60 60v40c0 11 9 20 20 20zm330-70h-20c-6 0-10 4-10 10v40c0 44-36 80-80 80H390c-44 0-80-36-80-80v-40c0-6-4-10-10-10h-20c-32 0-60 28-60 60v430c0 33 28 60 60 60h440c33 0 60-27 60-60V310c0-32-27-60-60-60zM366 583c25-49 76-83 136-83s112 34 136 83c2 3 2 7 0 9-24 49-76 83-136 83s-111-34-136-83c-2-3-2-6 0-9zm136 67c35 0 63-28 63-62s-28-63-63-63-62 28-62 63 27 62 62 62zm0-100c21 0 38 17 38 38s-17 37-38 37-37-17-37-37 16-38 37-38z" />
    </svg>
  );
}
export default SvgDocumentPreview;
