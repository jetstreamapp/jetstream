import * as React from 'react';
function SvgGenericLoading(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path
        d="M515 220h-30c-8 0-15 7-15 15v130c0 8 7 15 15 15h30c8 0 15-7 15-15V235c0-8-7-15-15-15zm250 250H635c-8 0-15 7-15 15v30c0 8 7 15 15 15h130c8 0 15-7 15-15v-30c0-8-7-15-15-15zM515 620h-30c-8 0-15 7-15 15v130c0 8 7 15 15 15h30c8 0 15-7 15-15V635c0-8-7-15-15-15zM380 515v-30c0-8-7-15-15-15H235c-8 0-15 7-15 15v30c0 8 7 15 15 15h130c8 0 15-7 15-15zm215-89c6 6 15 6 21 0l92-92c6-6 6-15 0-21l-21-21c-6-6-15-6-21 0l-92 92c-6 6-6 15 0 21zm22 148c-6-6-15-6-21 0l-21 21c-6 6-6 15 0 21l92 92c6 6 15 6 21 0l21-21c6-6 6-15 0-21zm-212 0c-6-6-15-6-21 0l-92 92c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l92-92c6-6 6-15 0-21zm-71-283c-6-6-15-6-21 0l-21 21c-6 6-6 15 0 21l92 92c6 6 15 6 21 0l21-21c6-6 6-15 0-21z"
        opacity={0.15}
      />
    </svg>
  );
}
export default SvgGenericLoading;
