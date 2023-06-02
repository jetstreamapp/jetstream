import * as React from 'react';
function SvgNumberInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M74 80H26c-3.3 0-6-2.7-6-6V26c0-3.3 2.7-6 6-6h48c3.3 0 6 2.7 6 6v48c0 3.3-2.7 6-6 6zM28.1 30v40c0 1.1.9 2 2 2H70c1.1 0 2-.9 2-2V30c0-1.1-.9-2-2-2H30.1c-1.1 0-2 .9-2 2z"
      />
      <path
        fill="unset"
        d="M63 42.8h-3.7l1.6-6.1v-.1c0-.2-.2-.5-.5-.5h-2.9c-.2 0-.4.2-.5.4l-1.6 6.3H48l1.6-6.1v-.1c0-.2-.2-.5-.5-.5h-2.9c-.2 0-.4.2-.5.4l-1.6 6.3H40c-.2 0-.4.1-.5.3l-.7 2.8v.1c0 .2.2.5.5.5h3.9l-1.8 7.1h-4c-.2 0-.4.1-.5.3l-.7 2.8v.1c0 .2.2.5.5.5h3.7l-1.6 6.2v.1c0 .2.2.5.5.5h2.9c.2 0 .4-.1.5-.4l1.6-6.4h7.3l-1.6 6v.1c0 .2.2.5.5.5h2.9c.2 0 .4-.1.5-.4l1.6-6.4h4.1c.2 0 .4-.1.5-.4l.7-2.8v-.1c0-.2-.2-.5-.5-.5h-3.8l1.8-7.1h3.9c.2 0 .4-.1.5-.4l.7-2.8c.1-.1-.1-.2-.4-.2zM52.7 53.6h-7.4l1.8-7.1h7.3l-1.7 7.1z"
      />
    </svg>
  );
}
export default SvgNumberInput;
