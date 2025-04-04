import * as React from 'react';
function SvgCustom3(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M500 380c-66 0-120 54-120 120s54 120 120 120 120-54 120-120-54-120-120-120zm300 120c0-35-84-53-97-84-13-32 33-104 9-128s-96 22-128 9c-31-13-49-97-84-97s-53 84-84 97c-32 13-104-33-128-9s22 96 9 128c-13 31-97 49-97 84s84 53 97 84c13 32-33 104-9 128s96-22 128-9c31 13 49 97 84 97s53-84 84-97c32-13 104 33 128 9s-22-96-9-128c13-31 97-49 97-84zM500 680c-99 0-180-81-180-180s81-180 180-180 180 81 180 180-81 180-180 180z" />
    </svg>
  );
}
export default SvgCustom3;
