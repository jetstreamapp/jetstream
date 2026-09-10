import * as React from 'react';
import { Img } from 'react-email';
import { getEmailImageUrl } from '../email-assets';
import { EMAIL_STYLES } from '../shared-styles';

export const EmailProLogo = () => {
  return <Img src={getEmailImageUrl('jetstream-logo-pro-200w.png')} width="200" alt="Jetstream logo" style={EMAIL_STYLES.logo} />;
};
