import * as React from 'react';
function SvgAiApp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M393 20H127C68 20 20 68 20 127v267c0 59 48 107 107 107h267c59 0 107-48 107-107V127c0-59-48-107-107-107zm54 373c0 29-24 53-53 53H127c-29 0-53-24-53-53V127c0-29 24-53 53-53h267c29 0 53 24 53 53v267zm-68-142l-50-25c-15-8-27-20-35-35l-25-50c-4-7-14-7-17 0l-25 50c-8 15-20 27-35 35l-50 25c-7 4-7 14 0 17l50 25c15 8 27 20 35 35l25 50c4 7 14 7 17 0l25-50c8-15 20-27 35-35l50-25c7-4 7-14 0-17" />
    </svg>
  );
}
export default SvgAiApp;
