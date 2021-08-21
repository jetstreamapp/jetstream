// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let window: any;
import { logger } from '@jetstream/shared/client-logger';
import { useEffect, useRef, useState } from 'react';
import { GoogleApiClientConfig, GoogleApiData, useLoadGoogleApi } from './useLoadGoogleApi';

export interface UseDrivePickerOptions {
  scope?: string[];
}

export interface PickerConfiguration {
  title?: string;
  viewGroups?: google.picker.ViewGroup[];
  views: { view: google.picker.DocsView | google.picker.DocsUploadView | google.picker.ViewId; label?: string }[];
  features?: google.picker.Feature[];
  locale?: string;
  /** If true, then the picker will not build itself, allowing the user to perform any desired actions */
  skipBuild?: boolean;
}

export const DEFAULT_CONFIGURATION: PickerConfiguration = {
  viewGroups: [],
  views: [],
  features: [],
  locale: 'en',
};

/**
 * https://stackoverflow.com/questions/48459402/change-google-picker-docsview-title
 * setLabel is not documented and not included in typescript definition, but it works
 *
 *
 * @param view
 * @param label
 * @returns
 */
function setViewLabel(view: google.picker.DocsView | google.picker.DocsUploadView | google.picker.ViewId, label: string) {
  try {
    const _view: any = view;
    if (_view && typeof _view.setLabel === 'function') {
      _view.setLabel(label);
    }
  } catch (ex) {
    logger.warn('Unable to set view label');
  } finally {
    return view;
  }
}

export function useDrivePicker(
  apiConfig: GoogleApiClientConfig
): [
  (config: PickerConfiguration) => google.picker.PickerBuilder | undefined,
  {
    apiLoaded: boolean;
    auth: gapi.auth2.AuthResponse | undefined;
    apiData: GoogleApiData;
    data: google.picker.ResponseObject | undefined;
    picker: google.picker.PickerBuilder | undefined;
    scriptLoadError: string | undefined;
  }
] {
  const picker = useRef<google.picker.PickerBuilder>();
  const [apiData, signIn] = useLoadGoogleApi(apiConfig);
  const [callBackInfo, setCallBackInfo] = useState<google.picker.ResponseObject>();
  const [openAfterAuth, setOpenAfterAuth] = useState(false);
  const [config, setConfig] = useState<PickerConfiguration>(DEFAULT_CONFIGURATION);

  // If we were not already authorized when user clicked to open picker,
  // then auto-open after authorization is complete
  useEffect(() => {
    if (openAfterAuth && apiData.signedIn && apiData.authorized) {
      setOpenAfterAuth(false);
      createPicker(config);
    }
  }, [apiData.signedIn, apiData.authorized, openAfterAuth]);

  // open the picker
  const openPicker = (config: PickerConfiguration) => {
    setConfig(config);
    if (!apiData.signedIn || !apiData.authorized) {
      setOpenAfterAuth(true);
      signIn();
    } else {
      createPicker(config);
    }
    return picker.current;
  };

  const createPicker = ({ views, viewGroups, features, locale = 'en', title, skipBuild }: PickerConfiguration) => {
    picker.current = new google.picker.PickerBuilder()
      .setAppId(apiConfig.appId)
      .setDeveloperKey(apiConfig.apiKey)
      .setCallback(pickerCallback)
      .setOAuthToken(apiData.authResponse?.access_token)
      .setLocale(locale)
      .setSize(window.innerWidth * 0.9, window.innerHeight * 0.9);

    if (title) {
      picker.current.setTitle(title);
    }

    if (Array.isArray(viewGroups)) {
      viewGroups.forEach((viewGroup) => picker.current.addViewGroup(viewGroup));
    }

    if (Array.isArray(views)) {
      views.forEach(({ view, label }) => {
        if (label) {
          setViewLabel(view, label);
        }
        picker.current.addView(view);
      });
    }

    if (Array.isArray(features)) {
      features.forEach((feature) => picker.current.enableFeature(feature));
    }

    if (!skipBuild) {
      picker.current.build().setVisible(true);
    }

    return picker.current;
  };

  const pickerCallback = (data: google.picker.ResponseObject) => {
    if (data.action === window.google.picker.Action.PICKED) {
      setCallBackInfo(data);
    }
  };

  return [
    openPicker,
    {
      apiData,
      apiLoaded: apiData.hasInitialized,
      auth: apiData.authResponse,
      data: callBackInfo,
      picker: picker.current,
      scriptLoadError: apiData.error,
    },
  ];
}
