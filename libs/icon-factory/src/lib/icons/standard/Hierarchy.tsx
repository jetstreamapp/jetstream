import * as React from 'react';
function SvgHierarchy(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M463 463H294c-10 0-19 8-19 18v144h-56c-10 0-19 9-19 19v137c0 10 9 19 19 19h187c10 0 19-9 19-19V644c0-10-9-19-19-19h-56v-87h300v87h-56c-10 0-19 9-19 19v137c0 10 9 19 19 19h188c10 0 18-9 18-19V644c0-10-8-19-18-19h-57V481c0-10-9-18-19-18H538v-88h56c10 0 18-9 18-19V219c0-10-8-19-18-19H406c-10 0-19 9-19 19v137c0 10 9 19 19 19h57v88z" />
    </svg>
  );
}
export default SvgHierarchy;
