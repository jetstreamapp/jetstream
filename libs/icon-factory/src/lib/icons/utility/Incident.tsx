import * as React from 'react';
function SvgIncident(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M164 100h32a8 8 0 008-8V68h112v24a8 8 0 008 8h32a8 8 0 008-8V68a48 48 0 00-48-48H204a48 48 0 00-48 48v24a8 8 0 008 8zm96 267a18 18 0 1018 17 18 18 0 00-18-17zm192-219H68a48 48 0 00-48 48v256a48 48 0 0048 48h384a48 48 0 0048-48V196a48 48 0 00-48-48zm-55 302H123c-15 0-23-19-15-33l137-221a17 17 0 0130 0l137 221a21 21 0 01-15 33z" />
      <rect width={36} height={90} x={242} y={265} rx={6} />
    </svg>
  );
}
export default SvgIncident;
