import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';
import React from 'react';
import GoogleFileSelector from '../form/file-selector/GoogleFileSelector';
import GoogleSignIn from './GoogleSignIn';

export default {
  component: GoogleSignIn,
  title: 'GoogleSignIn',
};

export const filePickerWithSignIn = () => (
  <GoogleSignIn
    apiConfig={{
      appId: '1046118608516',
      apiKey: 'AIzaSyBKlRmVgUxJ928co_CTT1Rx_RbmkKiibgU',
      clientId: '1046118608516-54c1gdvmaosuh84k2oamot7a0kql3p0i.apps.googleusercontent.com',
    }}
    onError={action('onSignInError')}
    onSignInChanged={action('onSignInChanged')}
  >
    <GoogleFileSelector
      apiConfig={{
        appId: '1046118608516',
        apiKey: 'AIzaSyBKlRmVgUxJ928co_CTT1Rx_RbmkKiibgU',
        clientId: '1046118608516-54c1gdvmaosuh84k2oamot7a0kql3p0i.apps.googleusercontent.com',
      }}
      className={text('className', undefined)}
      label={text('label', 'Choose from Google Drive')}
      buttonLabel={text('buttonLabel', undefined)}
      helpText={text('buttonLabel', 'Some extra text')}
      hideLabel={boolean('hideLabel', false)}
      onSelected={action('onSelected')}
      onReadFile={action('onReadFile')}
      onError={action('onError')}
    />
  </GoogleSignIn>
);
