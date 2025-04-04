import * as React from 'react';
function SvgCaseComment(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M380 300h40c6 0 10-4 10-10v-30h140v30c0 6 4 10 10 10h40c6 0 10-4 10-10v-30c0-33-27-60-60-60H430c-33 0-60 27-60 60v30c0 6 4 10 10 10zm360 60H260c-33 0-60 27-60 60v320c0 33 27 60 60 60h480c33 0 60-27 60-60V420c0-33-27-60-60-60zM509 680c-23 0-44-6-62-16l-7-1-40 17c-6 2-12-4-10-10l17-41c1-2 0-5-1-6-10-16-15-34-15-54 0-61 53-110 118-110s118 49 118 110c0 62-53 111-118 111z" />
    </svg>
  );
}
export default SvgCaseComment;
