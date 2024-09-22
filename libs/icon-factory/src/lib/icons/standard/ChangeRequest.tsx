import * as React from 'react';
function SvgChangeRequest(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M375 300h40a9 9 0 0010-10v-30h140v30a9 9 0 0010 10h40a9 9 0 0010-10v-30a60 60 0 00-60-60H425a60 60 0 00-60 60v30a9 9 0 0010 10zm360 60H255a60 60 0 00-60 60v320a60 60 0 0060 60h480a60 60 0 0060-60V420a60 60 0 00-60-60zM462 586l-77 79a12 12 0 01-13 0l-77-79c-6-4-1-13 8-13h47a150 150 0 01153-152v57c-48 0-95 47-95 95h45c10 0 15 8 9 13zm242 0h-47a152 152 0 01-154 152v-57c57 0 97-38 97-95h-47c-10 0-14-8-8-14l77-78a12 12 0 0113 0l78 79c6 4 1 13-9 13z" />
    </svg>
  );
}
export default SvgChangeRequest;
