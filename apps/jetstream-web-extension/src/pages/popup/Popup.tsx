/* eslint-disable no-restricted-globals */
import { JetstreamLogoInverse } from '@jetstream/ui-core';
import { initAndRenderReact } from '@jetstream/web-extension-utils';
import { AppWrapperNotJetstreamOwnedPage } from '../../core/AppWrapperNotJetstreamOwnedPage';

initAndRenderReact(<Component />);

export function Component() {
  function handleClick() {
    console.log('click');
  }

  return (
    <AppWrapperNotJetstreamOwnedPage>
      <JetstreamLogoInverse className="slds-p-around_x-small" width="200px" />
      <button onClick={handleClick}>click me</button>
    </AppWrapperNotJetstreamOwnedPage>
  );
}
