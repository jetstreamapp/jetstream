import { initAndRenderReact } from '../../utils/web-extension.utils';

initAndRenderReact(<Component />);

export function Component() {
  function handleClick() {
    // TODO:
  }

  return (
    <>
      <h1>
        <span> Hello there, Options </span>
        Welcome jetstream-web-extension 👋
      </h1>
      <button onClick={handleClick}>click me</button>
    </>
  );
}
