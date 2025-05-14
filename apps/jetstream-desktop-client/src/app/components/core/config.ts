import { AxiosAdapterConfig } from '@jetstream/shared/data';
import { HashRouter } from 'react-router-dom';
import { desktopExtensionAxiosAdapter } from '../../utils/desktop-axios-adapter';

AxiosAdapterConfig.adapter = desktopExtensionAxiosAdapter;

export const CONFIG = {
  Router: HashRouter,
  baseName: '/',
};
