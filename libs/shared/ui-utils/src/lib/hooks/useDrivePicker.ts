import { logger } from '@jetstream/shared/client-logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleApiClientConfig, useGoogleApi } from './useGoogleApi';

export interface PickerConfigurationNew {
  title?: string;
  viewGroups?: google.picker.ViewGroup[];
  views: { view: google.picker.DocsView | google.picker.DocsUploadView | google.picker.ViewId; label?: string }[];
  features?: google.picker.Feature[];
  locale?: string;
  /** If true, then the picker will not build itself, allowing the user to perform any desired actions */
  skipBuild?: boolean;
}

/**
 * https://stackoverflow.com/questions/48459402/change-google-picker-docsview-title
 * setLabel is not documented and not included in typescript definition, but it works
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
    // eslint-disable-next-line no-unsafe-finally
    return view;
  }
}

export function useDrivePicker(apiConfig: GoogleApiClientConfig) {
  const picker = useRef<google.picker.PickerBuilder>();
  const { error, getToken, loading } = useGoogleApi(apiConfig);
  const [callBackInfo, setCallBackInfo] = useState<google.picker.ResponseObject>();

  useEffect(() => {
    logger.log('[GOOGLE][PICKER][RENDERED]');
  });

  const pickerCallback = useCallback((data: google.picker.ResponseObject) => {
    logger.log('[GOOGLE][PICKER]', data);
    if (data.action === window.google.picker.Action.PICKED) {
      setCallBackInfo(data);
    }
  }, []);

  const openPicker = useCallback(
    async ({ views, viewGroups, features, locale = 'en', title, skipBuild }: PickerConfigurationNew) => {
      logger.log('[GOOGLE][PICKER][RENDERED]openPicker()');
      const token = await getToken();

      picker.current = new google.picker.PickerBuilder()
        .setAppId(apiConfig.appId)
        .setDeveloperKey(apiConfig.apiKey)
        .setOAuthToken(token.access_token)
        .setLocale(locale)
        .setSize(window.innerWidth * 0.9, window.innerHeight * 0.9)
        .setCallback(pickerCallback);

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
    },
    [apiConfig.apiKey, apiConfig.appId, getToken, pickerCallback]
  );

  return {
    loading,
    error,
    data: callBackInfo,
    openPicker,
  };
}
